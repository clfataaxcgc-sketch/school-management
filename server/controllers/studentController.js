const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const Student = require("../models/Student");
const Class = require("../models/Class");
const { generateTempPassword, generateUniqueCode } = require("../utils/generateCredentials");

const STUDENT_POPULATE = [
  { path: "user", select: "firstName lastName email phone profileImage status createdAt" },
  { path: "class", select: "name academicYear" },
];

// @desc    Create a student (creates the User account + Student profile,
//          optionally placing the student in a class)
// @route   POST /api/students
// @access  Private/Admin
const createStudent = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    studentId,
    dateOfBirth,
    gender,
    classId,
  } = req.body;

  if (!firstName || !lastName || !email) {
    throw new ApiError(400, "firstName, lastName and email are required");
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists");
  }

  let validatedClassId = null;
  if (classId) {
    const cls = await Class.findOne({ _id: classId, schoolId: req.schoolId }).select("_id");
    if (!cls) throw new ApiError(400, "Invalid class ID");
    validatedClassId = cls._id;
  }

  const tempPassword = password || generateTempPassword();

  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password: tempPassword,
    role: "student",
    schoolId: req.schoolId,
  });

  let student;
  try {
    const finalStudentId = studentId || (await generateUniqueCode(Student, "studentId", "STU", req.schoolId));

    student = await Student.create({
      schoolId: req.schoolId,
      user: user._id,
      studentId: finalStudentId,
      dateOfBirth,
      gender,
      class: validatedClassId,
    });
  } catch (err) {
    // Roll back the User we just created so we don't leave an orphaned
    // account if the Student profile fails to save (e.g. duplicate studentId).
    await User.findByIdAndDelete(user._id);
    throw err;
  }

  await student.populate(STUDENT_POPULATE);

  res.status(201).json({
    success: true,
    student,
    ...(!password && { tempPassword, note: "Share this temporary password with the student." }),
  });
});

// @desc    List students with search + filters + pagination
// @route   GET /api/students?search=&status=&page=&limit=
// @access  Private/Admin
const getStudents = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Number(limit) || 20, 100);

  // Search by name/email requires matching against User first (that's
  // where those fields live), then filtering Student by the resulting ids
  // — combined with a direct studentId match so searching "STU2026..." works too.
  const userQuery = { role: "student", schoolId: req.schoolId };
  if (status) userQuery.status = status;
  if (search) {
    userQuery.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  const matchingUserIds = await User.find(userQuery).distinct("_id");

  // Every student query starts with the school filter.
  let studentFilter = { schoolId: req.schoolId };
  if (search) {
    studentFilter.$or = [
      { user: { $in: matchingUserIds } },
      { studentId: { $regex: search, $options: "i" } },
    ];
  } else if (status) {
    studentFilter.user = { $in: matchingUserIds };
  }

  const [students, total] = await Promise.all([
    Student.find(studentFilter)
      .populate(STUDENT_POPULATE)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Student.countDocuments(studentFilter),
  ]);

  res.status(200).json({
    success: true,
    students,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Get one student
// @route   GET /api/students/:id
// @access  Private/Admin
const getStudentById = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.schoolId }).populate(STUDENT_POPULATE);
  if (!student) throw new ApiError(404, "Student not found");
  res.status(200).json({ success: true, student });
});

// @desc    Update a student (User fields + Student fields)
// @route   PUT /api/students/:id
// @access  Private/Admin
const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!student) throw new ApiError(404, "Student not found");

  const userUpdates = {};
  ["firstName", "lastName", "phone", "profileImage", "status"].forEach((f) => {
    if (req.body[f] !== undefined) userUpdates[f] = req.body[f];
  });
  if (Object.keys(userUpdates).length > 0) {
    await User.findOneAndUpdate({ _id: student.user, schoolId: req.schoolId }, userUpdates, {
      runValidators: true,
    });
  }

  const studentUpdates = {};
  ["dateOfBirth", "gender"].forEach((f) => {
    if (req.body[f] !== undefined) studentUpdates[f] = req.body[f];
  });

  if (req.body.classId !== undefined) {
    if (req.body.classId === null || req.body.classId === "") {
      studentUpdates.class = null;
    } else {
      const cls = await Class.findOne({ _id: req.body.classId, schoolId: req.schoolId }).select("_id");
      if (!cls) throw new ApiError(400, "Invalid class ID");
      studentUpdates.class = cls._id;
    }
  }

  if (Object.keys(studentUpdates).length > 0) {
    Object.assign(student, studentUpdates);
    await student.save();
  }

  await student.populate(STUDENT_POPULATE);
  res.status(200).json({ success: true, student });
});

// @desc    Delete a student (removes the Student profile and the User account)
// @route   DELETE /api/students/:id
// @access  Private/Admin
const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!student) throw new ApiError(404, "Student not found");

  await User.deleteOne({ _id: student.user, schoolId: req.schoolId });
  await student.deleteOne();

  res.status(200).json({ success: true, message: "Student deleted" });
});

module.exports = {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
};
