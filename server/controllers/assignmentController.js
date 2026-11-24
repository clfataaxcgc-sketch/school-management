const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Subject = require("../models/Subject");
const { assertTeachingAssignment } = require("../utils/teachingAssignment");
const { createNotification } = require("../utils/notifications");

const ASSIGNMENT_POPULATE = [
  { path: "subject", select: "name code" },
  { path: "class", select: "name" },
  { path: "teacher", populate: { path: "user", select: "firstName lastName" } },
];

// Attachment urls must point into THIS school's upload folder, so a user
// cannot attach a file that belongs to another school.
const validateAttachments = (attachments, schoolId) => {
  if (attachments === undefined || attachments === null) return [];
  if (!Array.isArray(attachments)) throw new ApiError(400, "attachments must be an array");
  const prefix = `/uploads/${schoolId}/`;
  attachments.forEach((a) => {
    if (!a || typeof a.url !== "string" || !a.url.startsWith(prefix) || a.url.includes("..")) {
      throw new ApiError(400, "Invalid attachment");
    }
  });
  return attachments;
};

// Derives a submission's display status relative to the assignment's due
// date. Grading always wins once it's happened; otherwise "late" means it
// came in after the deadline.
const deriveStatus = (submittedAt, dueDate) => (submittedAt > dueDate ? "late" : "submitted");

// @desc    Create an assignment
// @route   POST /api/assignments
// @access  Private/Teacher(assigned) or Admin
const createAssignment = asyncHandler(async (req, res) => {
  const { title, description, classId, subjectId, dueDate, maxPoints, attachments } = req.body;

  if (!title || !classId || !subjectId || !dueDate) {
    throw new ApiError(400, "title, classId, subjectId and dueDate are required");
  }

  const subject = await Subject.findOne({ _id: subjectId, schoolId: req.schoolId }).select("_id");
  if (!subject) throw new ApiError(400, "Invalid subject ID");

  const teacherId = await assertTeachingAssignment(req.user, classId, subjectId, req.schoolId);

  const cleanAttachments = validateAttachments(attachments, req.schoolId);

  const assignment = await Assignment.create({
    schoolId: req.schoolId,
    title,
    description,
    subject: subjectId,
    class: classId,
    teacher: teacherId,
    dueDate,
    maxPoints: maxPoints || 100,
    attachments: cleanAttachments,
  });

  await assignment.populate(ASSIGNMENT_POPULATE);

  // Notify every student in the class — doesn't block the response.
  const classStudents = await Student.find({ schoolId: req.schoolId, class: classId }).select("user");
  await Promise.all(
    classStudents.map((s) =>
      createNotification({
        schoolId: req.schoolId,
        userId: s.user,
        type: "assignment",
        title: `New assignment: ${title}`,
        body: `${assignment.subject?.name || ""} • Due ${new Date(dueDate).toLocaleDateString()}`,
        link: "/student/assignments",
      })
    )
  );

  res.status(201).json({ success: true, assignment });
});

// @desc    List assignments, scoped by role
// @route   GET /api/assignments?classId=&subjectId=
// @access  Private (all roles; scope depends on role)
const getAssignments = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.query;
  const filter = { schoolId: req.schoolId };
  if (classId) filter.class = classId;
  if (subjectId) filter.subject = subjectId;

  if (req.user.role === "admin") {
    // no extra scoping
  } else if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!teacher) throw new ApiError(403, "Teacher profile not found");
    filter.teacher = teacher._id;
  } else if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!student?.class) return res.status(200).json({ success: true, assignments: [] });
    filter.class = student.class;
  }

  const assignments = await Assignment.find(filter).populate(ASSIGNMENT_POPULATE).sort({ dueDate: -1 });

  // Enrich per role: teacher/admin get grading-progress stats; student/
  // get their own computed submission status.
  if (req.user.role === "admin" || req.user.role === "teacher") {
    const counts = await Submission.aggregate([
      { $match: { schoolId: req.schoolId, assignment: { $in: assignments.map((a) => a._id) } } },
      { $group: { _id: { assignment: "$assignment", status: "$status" }, count: { $sum: 1 } } },
    ]);
    const statsMap = {};
    counts.forEach((c) => {
      const key = c._id.assignment.toString();
      statsMap[key] = statsMap[key] || { submitted: 0, late: 0, graded: 0 };
      statsMap[key][c._id.status] = c.count;
    });
    const enriched = assignments.map((a) => ({
      ...a.toObject(),
      submissionStats: statsMap[a._id.toString()] || { submitted: 0, late: 0, graded: 0 },
    }));
    return res.status(200).json({ success: true, assignments: enriched });
  }

  let studentId = null;
  if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id, schoolId: req.schoolId }).select("_id");
    studentId = student._id;
  }

  const submissions = studentId
    ? await Submission.find({
        schoolId: req.schoolId,
        assignment: { $in: assignments.map((a) => a._id) },
        student: studentId,
      })
    : [];
  const submissionMap = Object.fromEntries(submissions.map((s) => [s.assignment.toString(), s]));

  const enriched = assignments.map((a) => {
    const sub = submissionMap[a._id.toString()];
    let status;
    if (sub) status = sub.status;
    else status = new Date() > a.dueDate ? "late" : "pending";
    return { ...a.toObject(), myStatus: status, mySubmission: sub || null };
  });

  res.status(200).json({ success: true, assignments: enriched });
});

// @desc    Get one assignment (with submissions for teacher/admin, or the
//          caller's own submission for a student)
// @route   GET /api/assignments/:id
// @access  Private (all roles; scope enforced)
const getAssignmentById = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.id, schoolId: req.schoolId }).populate(ASSIGNMENT_POPULATE);
  if (!assignment) throw new ApiError(404, "Assignment not found");

  if (req.user.role === "admin") {
    const submissions = await Submission.find({ schoolId: req.schoolId, assignment: assignment._id }).populate({
      path: "student",
      populate: { path: "user", select: "firstName lastName email" },
    });
    return res.status(200).json({ success: true, assignment, submissions });
  }

  if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!teacher || assignment.teacher?.toString() !== teacher._id.toString()) {
      throw new ApiError(403, "You did not create this assignment");
    }
    const submissions = await Submission.find({ schoolId: req.schoolId, assignment: assignment._id }).populate({
      path: "student",
      populate: { path: "user", select: "firstName lastName email" },
    });
    return res.status(200).json({ success: true, assignment, submissions });
  }

  let studentId = null;
  if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id, schoolId: req.schoolId }).select("_id");
    studentId = student?._id;
  } else {
    throw new ApiError(403, "Not authorized");
  }

  const submission = studentId ? await Submission.findOne({ schoolId: req.schoolId, assignment: assignment._id, student: studentId }) : null;
  res.status(200).json({ success: true, assignment, submission });
});

// @desc    Update an assignment
// @route   PUT /api/assignments/:id
// @access  Private/Teacher(owner) or Admin
const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!assignment) throw new ApiError(404, "Assignment not found");

  if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!teacher || assignment.teacher?.toString() !== teacher._id.toString()) {
      throw new ApiError(403, "You did not create this assignment");
    }
  } else if (req.user.role !== "admin") {
    throw new ApiError(403, "Not authorized");
  }

  ["title", "description", "dueDate", "maxPoints"].forEach((f) => {
    if (req.body[f] !== undefined) assignment[f] = req.body[f];
  });
  if (req.body.attachments !== undefined) {
    assignment.attachments = validateAttachments(req.body.attachments, req.schoolId);
  }

  await assignment.save();
  await assignment.populate(ASSIGNMENT_POPULATE);
  res.status(200).json({ success: true, assignment });
});

// @desc    Delete an assignment (and its submissions)
// @route   DELETE /api/assignments/:id
// @access  Private/Teacher(owner) or Admin
const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!assignment) throw new ApiError(404, "Assignment not found");

  if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!teacher || assignment.teacher?.toString() !== teacher._id.toString()) {
      throw new ApiError(403, "You did not create this assignment");
    }
  } else if (req.user.role !== "admin") {
    throw new ApiError(403, "Not authorized");
  }

  await Submission.deleteMany({ schoolId: req.schoolId, assignment: assignment._id });
  await assignment.deleteOne();

  res.status(200).json({ success: true, message: "Assignment deleted" });
});

// @desc    Submit (or resubmit, until graded) an assignment
// @route   POST /api/assignments/:id/submit
// @access  Private/Student
const submitAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!assignment) throw new ApiError(404, "Assignment not found");

  const student = await Student.findOne({ user: req.user._id, schoolId: req.schoolId });
  if (!student) throw new ApiError(403, "Student profile not found");
  if (student.class?.toString() !== assignment.class.toString()) {
    throw new ApiError(403, "This assignment is not for your class");
  }

  const { textResponse } = req.body;
  const attachments = validateAttachments(req.body.attachments, req.schoolId);
  if (!textResponse && attachments.length === 0) {
    throw new ApiError(400, "Provide a text response or at least one attachment");
  }

  let submission = await Submission.findOne({ schoolId: req.schoolId, assignment: assignment._id, student: student._id });
  if (submission && submission.status === "graded") {
    throw new ApiError(400, "This assignment has already been graded and can no longer be resubmitted");
  }

  const now = new Date();
  const status = deriveStatus(now, assignment.dueDate);

  if (submission) {
    submission.textResponse = textResponse;
    submission.attachments = attachments;
    submission.submittedAt = now;
    submission.status = status;
    await submission.save();
  } else {
    submission = await Submission.create({
      schoolId: req.schoolId, assignment: assignment._id,
      student: student._id,
      textResponse,
      attachments,
      submittedAt: now,
      status,
    });
  }

  res.status(200).json({ success: true, submission });
});

// @desc    Grade (and give feedback on) a student's submission
// @route   PUT /api/assignments/:id/submissions/:submissionId/grade
// @access  Private/Teacher(owner) or Admin
const gradeSubmission = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!assignment) throw new ApiError(404, "Assignment not found");

  let teacherId = null;
  if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: req.user._id, schoolId: req.schoolId });
    if (!teacher || assignment.teacher?.toString() !== teacher._id.toString()) {
      throw new ApiError(403, "You did not create this assignment");
    }
    teacherId = teacher._id;
  } else if (req.user.role !== "admin") {
    throw new ApiError(403, "Not authorized");
  }

  const submission = await Submission.findOne({ _id: req.params.submissionId, schoolId: req.schoolId, assignment: assignment._id });
  if (!submission) throw new ApiError(404, "Submission not found");

  const { grade, feedback } = req.body;
  if (grade === undefined || grade === null) throw new ApiError(400, "grade is required");
  if (grade < 0 || grade > assignment.maxPoints) {
    throw new ApiError(400, `grade must be between 0 and ${assignment.maxPoints}`);
  }

  submission.grade = grade;
  submission.feedback = feedback || "";
  submission.status = "graded";
  submission.gradedAt = new Date();
  submission.gradedBy = teacherId || assignment.teacher;
  await submission.save();

  const student = await Student.findOne({ _id: submission.student, schoolId: req.schoolId }).select(
    "user"
  );
  if (student) {
    await createNotification({
      schoolId: req.schoolId,
      userId: student.user,
      type: "grade",
      title: `Your submission for "${assignment.title}" was graded`,
      body: `${grade}/${assignment.maxPoints}`,
      link: "/student/assignments",
    });
  }

  res.status(200).json({ success: true, submission });
});

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
};
