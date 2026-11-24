const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Grade = require("../models/Grade");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Subject = require("../models/Subject");
const { assertTeachingAssignment } = require("../utils/teachingAssignment");
const { computeGradeSummary, COMPONENT_KEYS } = require("../utils/gradeCalculations");
const { createNotification } = require("../utils/notifications");

const withSummary = (grade) => ({
  ...grade.toObject(),
  summary: computeGradeSummary(grade.components),
});

const validateComponents = (components = {}) => {
  const clean = {};
  COMPONENT_KEYS.forEach((key) => {
    const c = components[key];
    if (c === undefined) return; // not being updated
    if (c === null) {
      clean[key] = { score: null, maxScore: null };
      return;
    }
    if (c.score !== null && c.score !== undefined) {
      if (typeof c.score !== "number" || c.score < 0) {
        throw new ApiError(400, `${key} score must be a non-negative number`);
      }
      if (!c.maxScore || c.maxScore < 1) {
        throw new ApiError(400, `${key} maxScore is required when a score is provided`);
      }
      if (c.score > c.maxScore) {
        throw new ApiError(400, `${key} score cannot exceed maxScore`);
      }
    }
    clean[key] = { score: c.score ?? null, maxScore: c.maxScore ?? null };
  });
  return clean;
};

// @desc    Create or update one student's grade entry for a subject/class
//          (partial: only the components included in the body are changed)
// @route   PUT /api/grades
// @access  Private/Teacher(assigned) or Admin
const upsertGrade = asyncHandler(async (req, res) => {
  const { studentId, classId, subjectId, components } = req.body;
  if (!studentId || !classId || !subjectId) {
    throw new ApiError(400, "studentId, classId and subjectId are required");
  }

  const teacherId = await assertTeachingAssignment(req.user, classId, subjectId, req.schoolId);

  // The subject must belong to this school too.
  const subject = await Subject.findOne({ _id: subjectId, schoolId: req.schoolId }).select("name");
  if (!subject) throw new ApiError(400, "Invalid subject ID");

  const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId }).select(
    "class user"
  );
  if (!student) throw new ApiError(404, "Student not found");
  if (student.class?.toString() !== classId) {
    throw new ApiError(400, "This student is not enrolled in that class");
  }

  const cleanComponents = validateComponents(components);

  let grade = await Grade.findOne({
    schoolId: req.schoolId,
    student: studentId,
    subject: subjectId,
    class: classId,
  });
  if (!grade) {
    grade = new Grade({
      schoolId: req.schoolId,
      student: studentId,
      subject: subjectId,
      class: classId,
    });
  }
  Object.assign(grade.components, cleanComponents);
  if (teacherId) grade.teacher = teacherId;
  await grade.save();

  const hasScore = Object.values(cleanComponents).some((c) => c && c.score !== null && c.score !== undefined);
  if (hasScore) {
    await createNotification({
      schoolId: req.schoolId,
      userId: student.user,
      type: "grade",
      title: `New grade posted for ${subject?.name || "a subject"}`,
      link: "/student/grades",
    });
  }

  res.status(200).json({ success: true, grade: withSummary(grade) });
});

// @desc    Bulk create/update grade entries for many students at once
//          (used by the teacher gradebook table's "Save All")
// @route   PUT /api/grades/bulk
// @access  Private/Teacher(assigned) or Admin
const bulkUpsertGrades = asyncHandler(async (req, res) => {
  const { classId, subjectId, entries } = req.body;
  if (!classId || !subjectId || !Array.isArray(entries) || entries.length === 0) {
    throw new ApiError(400, "classId, subjectId and a non-empty entries array are required");
  }

  const teacherId = await assertTeachingAssignment(req.user, classId, subjectId, req.schoolId);

  const subject = await Subject.findOne({ _id: subjectId, schoolId: req.schoolId }).select("name");
  if (!subject) throw new ApiError(400, "Invalid subject ID");

  const classStudents = await Student.find({ schoolId: req.schoolId, class: classId }).select(
    "_id user"
  );
  const classStudentIds = new Set(classStudents.map((s) => s._id.toString()));
  const studentUserMap = Object.fromEntries(classStudents.map((s) => [s._id.toString(), s.user]));

  const results = [];
  for (const entry of entries) {
    if (!entry.studentId || !classStudentIds.has(entry.studentId)) {
      throw new ApiError(400, `Student ${entry.studentId} is not enrolled in this class`);
    }
    const cleanComponents = validateComponents(entry.components);

    let grade = await Grade.findOne({
      schoolId: req.schoolId,
      student: entry.studentId,
      subject: subjectId,
      class: classId,
    });
    if (!grade) {
      grade = new Grade({
        schoolId: req.schoolId,
        student: entry.studentId,
        subject: subjectId,
        class: classId,
      });
    }
    Object.assign(grade.components, cleanComponents);
    if (teacherId) grade.teacher = teacherId;
    await grade.save();
    results.push(withSummary(grade));
  }

  await Promise.all(
    entries
      .filter((entry) =>
        Object.values(entry.components || {}).some((c) => c && c.score !== null && c.score !== undefined)
      )
      .map((entry) =>
        createNotification({
          schoolId: req.schoolId,
          userId: studentUserMap[entry.studentId],
          type: "grade",
          title: `New grade posted for ${subject?.name || "a subject"}`,
          link: "/student/grades",
        })
      )
  );

  res.status(200).json({ success: true, grades: results });
});

// @desc    Gradebook for a class+subject: every enrolled student with their
//          grade entry (or nulls if not yet entered)
// @route   GET /api/grades/class/:classId/report?subjectId=
// @access  Private/Admin or Teacher assigned to this class
const getClassGrades = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { subjectId } = req.query;
  if (!subjectId) throw new ApiError(400, "subjectId is required");

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

  const students = await Student.find({ schoolId: req.schoolId, class: classId }).populate(
    "user",
    "firstName lastName"
  );
  const grades = await Grade.find({ schoolId: req.schoolId, class: classId, subject: subjectId });
  const gradeMap = Object.fromEntries(grades.map((g) => [g.student.toString(), g]));

  const rows = students.map((student) => {
    const grade = gradeMap[student._id.toString()];
    return {
      studentId: student._id,
      name: `${student.user?.firstName} ${student.user?.lastName}`,
      components: grade?.components || {},
      summary: grade ? computeGradeSummary(grade.components) : computeGradeSummary({}),
    };
  });

  res.status(200).json({ success: true, rows });
});

// Shared logic for pulling one student's grades across all subjects (or one).
const buildStudentGrades = async (studentId, subjectId, schoolId) => {
  const filter = { schoolId, student: studentId };
  if (subjectId) filter.subject = subjectId;

  const grades = await Grade.find(filter).populate("subject", "name code").populate("class", "name");
  return grades.map((g) => ({
    subject: g.subject?.name,
    subjectCode: g.subject?.code,
    class: g.class?.name,
    components: g.components,
    summary: computeGradeSummary(g.components),
  }));
};

// @desc    One student's grades (all subjects, or filtered to one)
// @route   GET /api/grades/student/:studentId?subjectId=
// @access  Private/Admin, the student's assigned teachers, or the student
//          themself
const getStudentGrades = asyncHandler(async (req, res) => {
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
      throw new ApiError(403, "You can only view your own grades");
    }
  } else {
    throw new ApiError(403, "Not authorized");
  }

  const grades = await buildStudentGrades(studentId, req.query.subjectId, req.schoolId);
  res.status(200).json({ success: true, grades });
});

// @desc    Convenience endpoint: the logged-in student's own grades
// @route   GET /api/grades/me?subjectId=
// @access  Private/Student
const getMyGrades = asyncHandler(async (req, res) => {
  let studentId;

  if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!student) throw new ApiError(404, "Student profile not found");
    studentId = student._id;
  } else {
    throw new ApiError(403, "This endpoint is for students");
  }

  const grades = await buildStudentGrades(studentId, req.query.subjectId, req.schoolId);
  res.status(200).json({ success: true, studentId, grades });
});

module.exports = {
  upsertGrade,
  bulkUpsertGrades,
  getClassGrades,
  getStudentGrades,
  getMyGrades,
};
