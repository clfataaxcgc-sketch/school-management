const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const Teacher = require("../models/Teacher");
const { generateTempPassword, generateUniqueCode } = require("../utils/generateCredentials");

const TEACHER_POPULATE = [
  { path: "user", select: "firstName lastName email phone profileImage status createdAt" },
  { path: "subjects", select: "name code" },
  { path: "classes", select: "name academicYear" },
];

// @desc    Create a teacher (creates the User account + Teacher profile)
// @route   POST /api/teachers
// @access  Private/Admin
const createTeacher = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, password, employeeId } = req.body;

  if (!firstName || !lastName || !email) {
    throw new ApiError(400, "firstName, lastName and email are required");
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const tempPassword = password || generateTempPassword();

  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password: tempPassword,
    role: "teacher",
    schoolId: req.schoolId,
  });

  let teacher;
  try {
    const finalEmployeeId = employeeId || (await generateUniqueCode(Teacher, "employeeId", "EMP", req.schoolId));
    teacher = await Teacher.create({
      schoolId: req.schoolId,
      user: user._id,
      employeeId: finalEmployeeId,
    });
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    throw err;
  }

  await teacher.populate(TEACHER_POPULATE);

  res.status(201).json({
    success: true,
    teacher,
    ...(!password && { tempPassword, note: "Share this temporary password with the teacher." }),
  });
});

// @desc    List teachers with search + filter + pagination
// @route   GET /api/teachers?search=&status=&page=&limit=
// @access  Private/Admin
const getTeachers = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Number(limit) || 20, 100);

  const userQuery = { role: "teacher", schoolId: req.schoolId };
  if (status) userQuery.status = status;
  if (search) {
    userQuery.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  const matchingUserIds = await User.find(userQuery).distinct("_id");

  // Every teacher query starts with the school filter.
  let teacherFilter = { schoolId: req.schoolId };
  if (search) {
    teacherFilter.$or = [
      { user: { $in: matchingUserIds } },
      { employeeId: { $regex: search, $options: "i" } },
    ];
  } else if (status) {
    teacherFilter.user = { $in: matchingUserIds };
  }

  const [teachers, total] = await Promise.all([
    Teacher.find(teacherFilter)
      .populate(TEACHER_POPULATE)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Teacher.countDocuments(teacherFilter),
  ]);

  res.status(200).json({
    success: true,
    teachers,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Get one teacher
// @route   GET /api/teachers/:id
// @access  Private/Admin
const getTeacherById = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({ _id: req.params.id, schoolId: req.schoolId }).populate(
    TEACHER_POPULATE
  );
  if (!teacher) throw new ApiError(404, "Teacher not found");
  res.status(200).json({ success: true, teacher });
});

// @desc    Update a teacher (User fields; employeeId is immutable by design)
// @route   PUT /api/teachers/:id
// @access  Private/Admin
const updateTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!teacher) throw new ApiError(404, "Teacher not found");

  const userUpdates = {};
  ["firstName", "lastName", "phone", "profileImage", "status"].forEach((f) => {
    if (req.body[f] !== undefined) userUpdates[f] = req.body[f];
  });
  if (Object.keys(userUpdates).length > 0) {
    await User.findOneAndUpdate({ _id: teacher.user, schoolId: req.schoolId }, userUpdates, {
      runValidators: true,
    });
  }

  await teacher.populate(TEACHER_POPULATE);
  res.status(200).json({ success: true, teacher });
});

// @desc    Delete a teacher (removes Teacher profile + User account)
// @route   DELETE /api/teachers/:id
// @access  Private/Admin
const deleteTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!teacher) throw new ApiError(404, "Teacher not found");

  await User.deleteOne({ _id: teacher.user, schoolId: req.schoolId });
  await teacher.deleteOne();

  res.status(200).json({ success: true, message: "Teacher deleted" });
});

// @desc    Get the logged-in teacher's own profile (for self-service pages
//          like "Take Attendance" that need their assigned classes/subjects)
// @route   GET /api/teachers/me
// @access  Private/Teacher
const getMyTeacherProfile = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne({ user: req.user._id, schoolId: req.schoolId }).populate(
    TEACHER_POPULATE
  );
  if (!teacher) throw new ApiError(404, "Teacher profile not found");
  res.status(200).json({ success: true, teacher });
});

module.exports = {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  getMyTeacherProfile,
};
