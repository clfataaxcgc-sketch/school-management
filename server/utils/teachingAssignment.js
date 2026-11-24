const ApiError = require("./ApiError");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");

// Verifies the requesting user may act on behalf of a given class+subject
// (taking attendance, creating an assignment, etc): either they're an
// admin, or they're the teacher actually assigned to teach that subject
// for that class (per Class.subjects). Returns the Teacher ObjectId to
// attribute the action to — the assigned subject-teacher when an admin
// acts on their behalf, or the caller's own Teacher._id — or null if an
// admin acts on a subject with no teacher assigned yet.
// schoolId comes from req.schoolId, so the class and teacher must belong to
// the caller's school.
const assertTeachingAssignment = async (user, classId, subjectId, schoolId) => {
  const cls = await Class.findOne({ _id: classId, schoolId });
  if (!cls) throw new ApiError(404, "Class not found");

  if (user.role === "admin") {
    const match = cls.subjects.find((s) => s.subject.toString() === subjectId);
    return match?.teacher || null;
  }

  if (user.role !== "teacher") {
    throw new ApiError(403, "Only teachers or admins can perform this action");
  }

  const teacher = await Teacher.findOne({ user: user._id, schoolId });
  if (!teacher) throw new ApiError(403, "Teacher profile not found");

  const assigned = cls.subjects.some(
    (s) => s.subject.toString() === subjectId && s.teacher?.toString() === teacher._id.toString()
  );
  if (!assigned) {
    throw new ApiError(403, "You are not assigned to teach this subject for this class");
  }

  return teacher._id;
};

module.exports = { assertTeachingAssignment };
