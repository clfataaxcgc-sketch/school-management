const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Subject = require("../models/Subject");
const { computeGradeSummary } = require("../utils/gradeCalculations");

// Verifies the requester may view reports for this class: admin always,
// teacher only if actually assigned there (per Teacher.classes, kept in
// sync by classController's recomputeTeacherAssignments).
// schoolId comes from req.schoolId, so the class must be in the caller's school.
const assertClassAccess = async (user, classId, schoolId) => {
  const cls = await Class.findOne({ _id: classId, schoolId });
  if (!cls) throw new ApiError(404, "Class not found");

  if (user.role === "admin") return;
  if (user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: user._id, schoolId });
    if (!teacher || !teacher.classes.map((c) => c.toString()).includes(classId)) {
      throw new ApiError(403, "You are not assigned to this class");
    }
    return;
  }
  throw new ApiError(403, "Not authorized");
};

const escapeCsv = (value) => {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// Keeps only letters, numbers, dot, dash and underscore so a class or subject
// name cannot break the Content-Disposition header.
const safeFileName = (text) => String(text).replace(/[^a-zA-Z0-9._-]/g, "_");

const toCsv = (headers, rows) =>
  [headers.map(escapeCsv).join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");

// @desc    Monthly attendance % trend for a class (optionally one subject),
//          last N months, zero-filled so the chart has no gaps
// @route   GET /api/reports/attendance-trend?classId=&subjectId=&months=
// @access  Private/Admin or Teacher assigned to the class
const getAttendanceTrend = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.query;
  const months = Math.min(Number(req.query.months) || 6, 24);
  if (!classId) throw new ApiError(400, "classId is required");

  await assertClassAccess(req.user, classId, req.schoolId);

  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  // aggregate() does not cast ids for us, so schoolId must already be an ObjectId
  // (req.schoolId is, because it comes from the database user).
  const match = {
    schoolId: req.schoolId,
    class: new mongoose.Types.ObjectId(classId),
    date: { $gte: since },
  };
  if (subjectId) match.subject = new mongoose.Types.ObjectId(subjectId);

  const results = await Attendance.aggregate([
    { $match: match },
    { $unwind: "$records" },
    {
      $group: {
        _id: { year: { $year: "$date" }, month: { $month: "$date" }, status: "$records.status" },
        count: { $sum: 1 },
      },
    },
  ]);

  const series = [];
  const cursor = new Date(since);
  for (let i = 0; i < months; i++) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const label = cursor.toLocaleString("en-US", { month: "short", year: "2-digit" });

    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    results
      .filter((r) => r._id.year === year && r._id.month === month)
      .forEach((r) => {
        if (counts[r._id.status] !== undefined) counts[r._id.status] = r.count;
      });
    const countedTotal = counts.present + counts.absent + counts.late;
    const percentage = countedTotal > 0 ? Math.round(((counts.present + counts.late) / countedTotal) * 1000) / 10 : null;

    series.push({ month: label, percentage });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  res.status(200).json({ success: true, series });
});

// @desc    Letter-grade distribution for a class+subject, or school-wide
//          for admins when no filters are given
// @route   GET /api/reports/grade-distribution?classId=&subjectId=
// @access  Private/Admin or Teacher assigned to the class
const getGradeDistribution = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.query;

  const filter = { schoolId: req.schoolId };
  if (classId) {
    await assertClassAccess(req.user, classId, req.schoolId);
    filter.class = classId;
  } else if (req.user.role !== "admin") {
    throw new ApiError(400, "classId is required");
  }
  if (subjectId) filter.subject = subjectId;

  const grades = await Grade.find(filter).select("components");
  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  grades.forEach((g) => {
    const { letter } = computeGradeSummary(g.components);
    if (letter) distribution[letter] += 1;
  });

  res.status(200).json({ success: true, distribution });
});

// @desc    Per-class comparison: attendance % (last 30 days) and average
//          grade %, for every class — for the admin's class-comparison chart
// @route   GET /api/reports/class-comparison
// @access  Private/Admin
const getClassComparison = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") throw new ApiError(403, "Admin only");

  const classes = await Class.find({ schoolId: req.schoolId }).select("name");
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await Promise.all(
    classes.map(async (cls) => {
      const attendanceAgg = await Attendance.aggregate([
        { $match: { schoolId: req.schoolId, class: cls._id, date: { $gte: since } } },
        { $unwind: "$records" },
        { $group: { _id: "$records.status", count: { $sum: 1 } } },
      ]);
      const counts = { present: 0, absent: 0, late: 0, excused: 0 };
      attendanceAgg.forEach((a) => {
        if (counts[a._id] !== undefined) counts[a._id] = a.count;
      });
      const countedTotal = counts.present + counts.absent + counts.late;
      const attendancePercentage =
        countedTotal > 0 ? Math.round(((counts.present + counts.late) / countedTotal) * 1000) / 10 : null;

      const grades = await Grade.find({ schoolId: req.schoolId, class: cls._id }).select("components");
      const gradePercentages = grades
        .map((g) => computeGradeSummary(g.components).percentage)
        .filter((p) => p !== null);
      const averageGrade =
        gradePercentages.length > 0
          ? Math.round((gradePercentages.reduce((a, b) => a + b, 0) / gradePercentages.length) * 10) / 10
          : null;

      return { classId: cls._id, name: cls.name, attendancePercentage, averageGrade };
    })
  );

  res.status(200).json({ success: true, rows });
});

// @desc    Export a class's attendance summary as CSV
// @route   GET /api/reports/attendance/export?classId=&subjectId=&from=&to=
// @access  Private/Admin or Teacher assigned to the class
const exportAttendanceCsv = asyncHandler(async (req, res) => {
  const { classId, subjectId, from, to } = req.query;
  if (!classId) throw new ApiError(400, "classId is required");
  await assertClassAccess(req.user, classId, req.schoolId);

  const filter = { schoolId: req.schoolId, class: classId };
  if (subjectId) filter.subject = subjectId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const sessions = await Attendance.find(filter);
  const students = await Student.find({ schoolId: req.schoolId, class: classId }).populate(
    "user",
    "firstName lastName"
  );
  const cls = await Class.findOne({ _id: classId, schoolId: req.schoolId }).select("name");

  const rows = students.map((student) => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    sessions.forEach((session) => {
      const rec = session.records.find((r) => r.student.toString() === student._id.toString());
      if (rec) counts[rec.status] += 1;
    });
    const countedTotal = counts.present + counts.absent + counts.late;
    const percentage = countedTotal > 0 ? Math.round(((counts.present + counts.late) / countedTotal) * 1000) / 10 : "";
    return [
      student.studentId,
      `${student.user?.firstName} ${student.user?.lastName}`,
      counts.present,
      counts.absent,
      counts.late,
      counts.excused,
      percentage,
    ];
  });

  const csv = toCsv(
    ["Student ID", "Name", "Present", "Absent", "Late", "Excused", "Attendance %"],
    rows
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${safeFileName(cls.name)}.csv"`);
  res.status(200).send(csv);
});

// @desc    Export a class+subject gradebook as CSV
// @route   GET /api/reports/grades/export?classId=&subjectId=
// @access  Private/Admin or Teacher assigned to the class
const exportGradesCsv = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.query;
  if (!classId || !subjectId) throw new ApiError(400, "classId and subjectId are required");
  await assertClassAccess(req.user, classId, req.schoolId);

  const students = await Student.find({ schoolId: req.schoolId, class: classId }).populate(
    "user",
    "firstName lastName"
  );
  const grades = await Grade.find({ schoolId: req.schoolId, class: classId, subject: subjectId });
  const gradeMap = Object.fromEntries(grades.map((g) => [g.student.toString(), g]));
  const cls = await Class.findOne({ _id: classId, schoolId: req.schoolId }).select("name");
  const subject = await Subject.findOne({ _id: subjectId, schoolId: req.schoolId }).select("name");
  if (!subject) throw new ApiError(404, "Subject not found");

  const rows = students.map((student) => {
    const grade = gradeMap[student._id.toString()];
    const c = grade?.components || {};
    const summary = computeGradeSummary(c);
    return [
      student.studentId,
      `${student.user?.firstName} ${student.user?.lastName}`,
      c.assignment?.score ?? "",
      c.quiz?.score ?? "",
      c.midterm?.score ?? "",
      c.final?.score ?? "",
      summary.percentage ?? "",
      summary.letter ?? "",
    ];
  });

  const csv = toCsv(
    ["Student ID", "Name", "Assignment", "Quiz", "Midterm", "Final", "Percentage", "Letter"],
    rows
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="grades-${safeFileName(cls.name)}-${safeFileName(subject.name)}.csv"`);
  res.status(200).send(csv);
});

module.exports = {
  getAttendanceTrend,
  getGradeDistribution,
  getClassComparison,
  exportAttendanceCsv,
  exportGradesCsv,
};
