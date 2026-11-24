const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Attendance = require("../models/Attendance");
const Class = require("../models/Class");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { assertTeachingAssignment } = require("../utils/teachingAssignment");
const { createNotification } = require("../utils/notifications");

const VALID_STATUSES = ["present", "absent", "late", "excused"];

const normalizeDate = (input) => {
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new ApiError(400, "Invalid date");
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const dateRangeFilter = (from, to) => {
  const filter = {};
  if (from) filter.$gte = normalizeDate(from);
  if (to) {
    const end = normalizeDate(to);
    end.setUTCHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return Object.keys(filter).length ? filter : null;
};

// @desc    Take (or update) attendance for a class+subject+date
// @route   POST /api/attendance
// @access  Private/Teacher(assigned) or Admin
const takeAttendance = asyncHandler(async (req, res) => {
  const { classId, subjectId, date, records } = req.body;

  if (!classId || !subjectId || !date || !Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, "classId, subjectId, date and a non-empty records array are required");
  }

  const subject = await Subject.findOne({ _id: subjectId, schoolId: req.schoolId }).select("_id name");
  if (!subject) throw new ApiError(400, "Invalid subject ID");

  const teacherId = await assertTeachingAssignment(req.user, classId, subjectId, req.schoolId);
  const normalizedDate = normalizeDate(date);

  // Validate every student belongs to this class and has a valid status
  const classStudents = await Student.find({ schoolId: req.schoolId, class: classId }).select(
    "_id user"
  );
  const classStudentIds = new Set(classStudents.map((s) => s._id.toString()));

  const cleanRecords = records.map((r) => {
    if (!r.studentId || !classStudentIds.has(r.studentId)) {
      throw new ApiError(400, `Student ${r.studentId} is not enrolled in this class`);
    }
    if (!VALID_STATUSES.includes(r.status)) {
      throw new ApiError(400, `Invalid status "${r.status}"`);
    }
    return { student: r.studentId, status: r.status };
  });

  let session = await Attendance.findOne({
    schoolId: req.schoolId,
    class: classId,
    subject: subjectId,
    date: normalizedDate,
  });

  if (session) {
    session.records = cleanRecords;
    if (teacherId) session.teacher = teacherId;
    await session.save();
  } else {
    session = await Attendance.create({
      schoolId: req.schoolId,
      class: classId,
      subject: subjectId,
      date: normalizedDate,
      teacher: teacherId,
      records: cleanRecords,
    });
  }

  await session.populate([
    { path: "class", select: "name" },
    { path: "subject", select: "name code" },
    { path: "records.student", populate: { path: "user", select: "firstName lastName" } },
  ]);

  // Notify any student marked absent today — doesn't block the response.
  const studentUserMap = Object.fromEntries(classStudents.map((s) => [s._id.toString(), s.user]));
  const absentees = cleanRecords.filter((r) => r.status === "absent");
  await Promise.all(
    absentees.map((r) =>
      createNotification({
        schoolId: req.schoolId,
        userId: studentUserMap[r.student],
        type: "attendance",
        title: `Marked absent in ${subject.name}`,
        body: normalizedDate.toLocaleDateString(),
        link: "/student/attendance",
      })
    )
  );

  res.status(200).json({ success: true, session });
});

// @desc    Get the attendance session for a specific class+subject+date
//          (used to pre-fill the "take attendance" screen for editing)
// @route   GET /api/attendance/session?classId=&subjectId=&date=
// @access  Private/Teacher(assigned) or Admin
const getSession = asyncHandler(async (req, res) => {
  const { classId, subjectId, date } = req.query;
  if (!classId || !subjectId || !date) {
    throw new ApiError(400, "classId, subjectId and date are required");
  }

  await assertTeachingAssignment(req.user, classId, subjectId, req.schoolId);
  const normalizedDate = normalizeDate(date);

  const session = await Attendance.findOne({
    schoolId: req.schoolId,
    class: classId,
    subject: subjectId,
    date: normalizedDate,
  }).populate([
    { path: "records.student", populate: { path: "user", select: "firstName lastName" } },
  ]);

  res.status(200).json({ success: true, session: session || null });
});

// @desc    Attendance report for a class over a date range: per-student
//          percentage summary + the raw list of sessions
// @route   GET /api/attendance/class/:classId/report?subjectId=&from=&to=
// @access  Private/Admin or Teacher assigned to this class
const getClassReport = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { subjectId, from, to } = req.query;

  const cls = await Class.findOne({ _id: classId, schoolId: req.schoolId });
  if (!cls) throw new ApiError(404, "Class not found");

  if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!teacher || !teacher.classes.map((c) => c.toString()).includes(classId)) {
      throw new ApiError(403, "You are not assigned to this class");
    }
  } else if (req.user.role !== "admin") {
    throw new ApiError(403, "Not authorized");
  }

  const filter = { schoolId: req.schoolId, class: classId };
  if (subjectId) filter.subject = subjectId;
  const range = dateRangeFilter(from, to);
  if (range) filter.date = range;

  const sessions = await Attendance.find(filter)
    .populate("subject", "name code")
    .sort({ date: -1 });

  const students = await Student.find({ schoolId: req.schoolId, class: classId }).populate(
    "user",
    "firstName lastName"
  );

  const summary = students.map((student) => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    sessions.forEach((session) => {
      const rec = session.records.find((r) => r.student.toString() === student._id.toString());
      if (rec) counts[rec.status] += 1;
    });
    const countedTotal = counts.present + counts.absent + counts.late;
    const percentage = countedTotal > 0 ? Math.round(((counts.present + counts.late) / countedTotal) * 1000) / 10 : null;
    return {
      studentId: student._id,
      name: `${student.user?.firstName} ${student.user?.lastName}`,
      ...counts,
      percentage,
    };
  });

  res.status(200).json({ success: true, sessions, summary });
});

// Shared logic for pulling one student's attendance history + percentage.
const buildStudentHistory = async (studentId, { from, to, subjectId }, schoolId) => {
  const filter = { schoolId, "records.student": studentId };
  if (subjectId) filter.subject = subjectId;
  const range = dateRangeFilter(from, to);
  if (range) filter.date = range;

  const sessions = await Attendance.find(filter)
    .populate("class", "name")
    .populate("subject", "name code")
    .sort({ date: -1 });

  const history = sessions.map((session) => {
    const rec = session.records.find((r) => r.student.toString() === studentId.toString());
    return {
      date: session.date,
      class: session.class?.name,
      subject: session.subject?.name,
      status: rec?.status,
    };
  });

  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  history.forEach((h) => {
    if (h.status) counts[h.status] += 1;
  });
  const countedTotal = counts.present + counts.absent + counts.late;
  const percentage = countedTotal > 0 ? Math.round(((counts.present + counts.late) / countedTotal) * 1000) / 10 : null;

  return { history, counts, percentage };
};

// @desc    One student's attendance history + percentage
// @route   GET /api/attendance/student/:studentId?from=&to=&subjectId=
// @access  Private/Admin, the student's assigned teachers, or the student
//          themself
const getStudentAttendance = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId });
  if (!student) throw new ApiError(404, "Student not found");

  if (req.user.role === "admin") {
    // allowed
  } else if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id, schoolId: req.schoolId });
    const teachesClass = teacher?.classes?.map((c) => c.toString()).includes(student.class?.toString());
    if (!teachesClass) throw new ApiError(403, "You do not teach this student's class");
  } else if (req.user.role === "student") {
    if (student.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You can only view your own attendance");
    }
  } else {
    throw new ApiError(403, "Not authorized");
  }

  const result = await buildStudentHistory(studentId, req.query, req.schoolId);
  res.status(200).json({ success: true, ...result });
});

// @desc    Convenience endpoint: the logged-in student's own attendance
// @route   GET /api/attendance/me?from=&to=&subjectId=
// @access  Private/Student
const getMyAttendance = asyncHandler(async (req, res) => {
  let studentId;

  if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!student) throw new ApiError(404, "Student profile not found");
    studentId = student._id;
  } else {
    throw new ApiError(403, "This endpoint is for students");
  }

  const result = await buildStudentHistory(studentId, req.query, req.schoolId);
  res.status(200).json({ success: true, studentId, ...result });
});

module.exports = {
  takeAttendance,
  getSession,
  getClassReport,
  getStudentAttendance,
  getMyAttendance,
};
