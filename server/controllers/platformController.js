const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const School = require("../models/School");
const User = require("../models/User");
const { disconnectSchool } = require("../utils/socket");

// The platform owner only sees school-level information (names, status and
// head-counts). School data such as students and grades is never exposed here.

// Makes text safe to use inside a regular expression (for the search box).
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Counts users per role for the given schools.
// Returns { schoolId: { admin: 1, teacher: 5, student: 40 } }
const getRoleCountsBySchool = async (schoolIds) => {
  const rows = await User.aggregate([
    { $match: { schoolId: { $in: schoolIds } } },
    { $group: { _id: { schoolId: "$schoolId", role: "$role" }, count: { $sum: 1 } } },
  ]);

  const result = {};
  rows.forEach((row) => {
    const id = row._id.schoolId.toString();
    result[id] = result[id] || { admin: 0, teacher: 0, student: 0 };
    result[id][row._id.role] = row.count;
  });
  return result;
};

const emptyCounts = { admin: 0, teacher: 0, student: 0 };

// @desc    Platform-wide numbers for the dashboard cards
// @route   GET /api/platform/stats
// @access  Private/PlatformOwner
const getPlatformStats = asyncHandler(async (req, res) => {
  const [totalSchools, activeSchools, inactiveSchools, userCounts] = await Promise.all([
    School.countDocuments(),
    School.countDocuments({ status: "active" }),
    School.countDocuments({ status: "inactive" }),
    User.aggregate([
      { $match: { role: { $ne: "platform_owner" } } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
  ]);

  const users = { admin: 0, teacher: 0, student: 0 };
  userCounts.forEach((row) => {
    if (users[row._id] !== undefined) users[row._id] = row.count;
  });

  res.status(200).json({
    success: true,
    stats: {
      totalSchools,
      activeSchools,
      inactiveSchools,
      totalUsers: users.admin + users.teacher + users.student,
      users,
    },
  });
});

// @desc    List all registered schools (search, filter by status, pagination)
// @route   GET /api/platform/schools?search=&status=&page=&limit=
// @access  Private/PlatformOwner
const getSchools = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Number(limit) || 20, 100);

  const filter = {};
  if (status === "active" || status === "inactive") filter.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ schoolName: pattern }, { schoolEmail: pattern }];
  }

  const [schools, total] = await Promise.all([
    School.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    School.countDocuments(filter),
  ]);

  const counts = await getRoleCountsBySchool(schools.map((s) => s._id));
  const rows = schools.map((school) => ({
    ...school.toObject(),
    userCounts: counts[school._id.toString()] || emptyCounts,
  }));

  res.status(200).json({
    success: true,
    schools: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Basic information about one school
// @route   GET /api/platform/schools/:id
// @access  Private/PlatformOwner
const getSchoolById = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) throw new ApiError(404, "School not found");

  const counts = await getRoleCountsBySchool([school._id]);
  const admin = await User.findOne({ schoolId: school._id, role: "admin" })
    .sort({ createdAt: 1 })
    .select("firstName lastName email phone");

  res.status(200).json({
    success: true,
    school: {
      ...school.toObject(),
      userCounts: counts[school._id.toString()] || emptyCounts,
      admin,
    },
  });
});

// @desc    Activate or deactivate a school
// @route   PATCH /api/platform/schools/:id/status   body: { status }
// @access  Private/PlatformOwner
const updateSchoolStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (status !== "active" && status !== "inactive") {
    throw new ApiError(400, 'status must be "active" or "inactive"');
  }

  const school = await School.findById(req.params.id);
  if (!school) throw new ApiError(404, "School not found");

  school.status = status;
  await school.save();

  // A deactivated school is kicked out of real-time connections right away.
  // (REST requests are already blocked by the protect middleware.)
  if (status === "inactive") disconnectSchool(school._id);

  res.status(200).json({ success: true, school });
});

module.exports = { getPlatformStats, getSchools, getSchoolById, updateSchoolStatus };
