const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Class = require("../models/Class");
const Subject = require("../models/Subject");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");

const CLASS_POPULATE = [
  { path: "classTeacher", populate: { path: "user", select: "firstName lastName email" } },
  {
    path: "subjects.subject",
    select: "name code",
  },
  {
    path: "subjects.teacher",
    populate: { path: "user", select: "firstName lastName" },
  },
];

// Recomputes a teacher's `classes` and `subjects` arrays from scratch by
// scanning every Class document, so they can never drift out of sync with
// the actual assignments — regardless of how many classes/subjects changed.
// Called for any teacher who was added to or removed from an assignment.
const recomputeTeacherAssignments = async (teacherIds = [], schoolId) => {
  const uniqueIds = [...new Set(teacherIds.filter(Boolean).map((id) => id.toString()))];
  await Promise.all(
    uniqueIds.map(async (teacherId) => {
      const [asClassTeacher, asSubjectTeacher] = await Promise.all([
        Class.find({ schoolId, classTeacher: teacherId }).select("_id"),
        Class.find({ schoolId, "subjects.teacher": teacherId }).select("_id subjects"),
      ]);

      const classIds = new Set(asClassTeacher.map((c) => c._id.toString()));
      const subjectIds = new Set();

      asSubjectTeacher.forEach((cls) => {
        classIds.add(cls._id.toString());
        cls.subjects.forEach((s) => {
          if (s.teacher && s.teacher.toString() === teacherId) {
            subjectIds.add(s.subject.toString());
          }
        });
      });

      await Teacher.findOneAndUpdate(
        { _id: teacherId, schoolId },
        { classes: [...classIds], subjects: [...subjectIds] }
      );
    })
  );
};

// The teacher must belong to the same school as the class.
const validateTeacherId = async (teacherId, schoolId) => {
  if (!teacherId) return null;
  const teacher = await Teacher.findOne({ _id: teacherId, schoolId }).select("_id");
  if (!teacher) throw new ApiError(400, "Invalid teacher ID");
  return teacher._id;
};

// @desc    Create a class
// @route   POST /api/classes
// @access  Private/Admin
const createClass = asyncHandler(async (req, res) => {
  const { name, academicYear, classTeacherId } = req.body;
  if (!name) throw new ApiError(400, "Class name is required");

  const exists = await Class.findOne({ schoolId: req.schoolId, name: name.trim() });
  if (exists) throw new ApiError(409, "A class with this name already exists");

  const validatedTeacherId = await validateTeacherId(classTeacherId, req.schoolId);

  const cls = await Class.create({
    schoolId: req.schoolId,
    name,
    academicYear,
    classTeacher: validatedTeacherId,
  });

  if (validatedTeacherId) await recomputeTeacherAssignments([validatedTeacherId], req.schoolId);

  await cls.populate(CLASS_POPULATE);
  res.status(201).json({ success: true, class: cls });
});

// @desc    List classes with search, student & subject counts
// @route   GET /api/classes?search=
// @access  Private/Admin
const getClasses = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = { schoolId: req.schoolId };
  if (search) filter.name = { $regex: search, $options: "i" };

  const classes = await Class.find(filter).populate(CLASS_POPULATE).sort({ name: 1 });

  const withCounts = await Promise.all(
    classes.map(async (cls) => {
      const studentCount = await Student.countDocuments({ schoolId: req.schoolId, class: cls._id });
      return { ...cls.toObject(), studentCount, subjectCount: cls.subjects.length };
    })
  );

  res.status(200).json({ success: true, classes: withCounts });
});

// @desc    Get one class with its full subject/teacher assignments and roster
// @route   GET /api/classes/:id
// @access  Private/Admin
const getClassById = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.id, schoolId: req.schoolId }).populate(
    CLASS_POPULATE
  );
  if (!cls) throw new ApiError(404, "Class not found");

  const students = await Student.find({ schoolId: req.schoolId, class: cls._id })
    .populate({ path: "user", select: "firstName lastName email profileImage" })
    .select("studentId user");

  res.status(200).json({ success: true, class: cls, students });
});

// @desc    Update class name/academicYear/classTeacher
// @route   PUT /api/classes/:id
// @access  Private/Admin
const updateClass = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!cls) throw new ApiError(404, "Class not found");

  const { name, academicYear, classTeacherId } = req.body;
  const previousTeacherId = cls.classTeacher?.toString();

  if (name !== undefined) cls.name = name;
  if (academicYear !== undefined) cls.academicYear = academicYear;

  let newTeacherId = previousTeacherId;
  if (classTeacherId !== undefined) {
    const validated = await validateTeacherId(classTeacherId, req.schoolId);
    cls.classTeacher = validated;
    newTeacherId = validated?.toString();
  }

  await cls.save();

  const affected = [previousTeacherId, newTeacherId].filter(Boolean);
  if (affected.length) await recomputeTeacherAssignments(affected, req.schoolId);

  await cls.populate(CLASS_POPULATE);
  res.status(200).json({ success: true, class: cls });
});

// @desc    Replace a class's subject↔teacher assignments
// @route   PUT /api/classes/:id/subjects
// @access  Private/Admin
// body: { subjects: [{ subjectId, teacherId }] }
const updateClassSubjects = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!cls) throw new ApiError(404, "Class not found");

  const incoming = Array.isArray(req.body.subjects) ? req.body.subjects : [];

  const subjectIds = incoming.map((s) => s.subjectId).filter(Boolean);
  if (subjectIds.length) {
    const found = await Subject.find({ _id: { $in: subjectIds }, schoolId: req.schoolId }).select("_id");
    if (found.length !== new Set(subjectIds).size) {
      throw new ApiError(400, "One or more subject IDs are invalid");
    }
  }

  const previousTeacherIds = cls.subjects.map((s) => s.teacher?.toString()).filter(Boolean);

  const newSubjects = [];
  for (const entry of incoming) {
    const teacherId = await validateTeacherId(entry.teacherId, req.schoolId);
    newSubjects.push({ subject: entry.subjectId, teacher: teacherId });
  }

  cls.subjects = newSubjects;
  await cls.save();

  const newTeacherIds = newSubjects.map((s) => s.teacher?.toString()).filter(Boolean);
  const affected = [...new Set([...previousTeacherIds, ...newTeacherIds])];
  if (affected.length) await recomputeTeacherAssignments(affected, req.schoolId);

  await cls.populate(CLASS_POPULATE);
  res.status(200).json({ success: true, class: cls });
});

// @desc    Replace the roster of students assigned to a class
// @route   PUT /api/classes/:id/students
// @access  Private/Admin
// body: { studentIds: [...] }
const updateClassStudents = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!cls) throw new ApiError(404, "Class not found");

  const studentIds = Array.isArray(req.body.studentIds) ? req.body.studentIds : [];
  if (studentIds.length) {
    const found = await Student.find({ _id: { $in: studentIds }, schoolId: req.schoolId }).select("_id");
    if (found.length !== new Set(studentIds).size) {
      throw new ApiError(400, "One or more student IDs are invalid");
    }
  }

  // Anyone currently in this class but not in the new roster gets un-assigned
  await Student.updateMany(
    { schoolId: req.schoolId, class: cls._id, _id: { $nin: studentIds } },
    { $set: { class: null } }
  );
  // Everyone in the new roster gets (re)assigned to this class
  await Student.updateMany(
    { schoolId: req.schoolId, _id: { $in: studentIds } },
    { $set: { class: cls._id } }
  );

  const students = await Student.find({ schoolId: req.schoolId, class: cls._id }).populate({
    path: "user",
    select: "firstName lastName email profileImage",
  });

  res.status(200).json({ success: true, students });
});

// @desc    Delete a class (unassigns its students and cleans up teacher
//          assignments; does not delete students or teachers themselves)
// @route   DELETE /api/classes/:id
// @access  Private/Admin
const deleteClass = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!cls) throw new ApiError(404, "Class not found");

  const affectedTeacherIds = [
    cls.classTeacher?.toString(),
    ...cls.subjects.map((s) => s.teacher?.toString()),
  ].filter(Boolean);

  await Student.updateMany({ schoolId: req.schoolId, class: cls._id }, { $set: { class: null } });
  await cls.deleteOne();

  if (affectedTeacherIds.length) {
    await recomputeTeacherAssignments(affectedTeacherIds, req.schoolId);
  }

  res.status(200).json({ success: true, message: "Class deleted" });
});

module.exports = {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  updateClassSubjects,
  updateClassStudents,
  deleteClass,
};
