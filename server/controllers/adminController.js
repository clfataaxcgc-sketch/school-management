const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const { computeGradeSummary } = require("../utils/gradeCalculations");

// @desc    Admin dashboard summary stats
// @route   GET /api/admin/stats
// @access  Private/Admin
//
// Only counts that can be computed from data that actually exists yet
// (Users) are real. Stats that depend on models from later phases
// (Class, Attendance, Grade, Announcement) are returned as null/0 with an
// `available` flag so the frontend can render an honest "coming soon"
// state instead of fabricating numbers.
const getDashboardStats = asyncHandler(async (req, res) => {
  // Every number on this dashboard is for the admin's own school only.
  const schoolId = req.schoolId;

  const [roleCounts, totalUsers, totalClasses, attendanceAgg, allGrades] = await Promise.all([
    User.aggregate([
      { $match: { schoolId } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    User.countDocuments({ schoolId }),
    Class.countDocuments({ schoolId }),
    // Overall attendance % across the last 30 days, all classes/subjects
    Attendance.aggregate([
      { $match: { schoolId, date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $unwind: "$records" },
      { $group: { _id: "$records.status", count: { $sum: 1 } } },
    ]),
    // Grade components aren't easily aggregated in Mongo (they're an object,
    // not an array), so pull components and compute in JS via the same
    // summary helper the rest of the app uses — school-scale data, cheap.
    Grade.find({ schoolId }).select("components"),
  ]);

  const counts = { admin: 0, teacher: 0, student: 0 };
  roleCounts.forEach((r) => {
    if (counts[r._id] !== undefined) counts[r._id] = r.count;
  });

  const attendanceCounts = { present: 0, absent: 0, late: 0, excused: 0 };
  attendanceAgg.forEach((a) => {
    if (attendanceCounts[a._id] !== undefined) attendanceCounts[a._id] = a.count;
  });
  const countedTotal = attendanceCounts.present + attendanceCounts.absent + attendanceCounts.late;
  const attendancePercentage =
    countedTotal > 0
      ? { value: Math.round(((attendanceCounts.present + attendanceCounts.late) / countedTotal) * 1000) / 10, available: true }
      : { value: null, available: false, comingIn: "Take attendance to see this" };

  const gradePercentages = allGrades
    .map((g) => computeGradeSummary(g.components).percentage)
    .filter((p) => p !== null);
  const averageGrade =
    gradePercentages.length > 0
      ? { value: Math.round((gradePercentages.reduce((a, b) => a + b, 0) / gradePercentages.length) * 10) / 10, available: true }
      : { value: null, available: false, comingIn: "Enter grades to see this" };

  res.status(200).json({
    success: true,
    stats: {
      totalStudents: counts.student,
      totalTeachers: counts.teacher,
      totalAdmins: counts.admin,
      totalUsers,

      totalClasses: { value: totalClasses, available: true },
      attendancePercentage,
      averageGrade,
    },
  });
});

// @desc    Most recently registered users (any role)
// @route   GET /api/admin/recent-registrations
// @access  Private/Admin
const getRecentRegistrations = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 50);

  const users = await User.find({ schoolId: req.schoolId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("firstName lastName email role status createdAt profileImage");

  res.status(200).json({ success: true, users });
});

// @desc    New-user registrations per month, split by role, for the last N months
// @route   GET /api/admin/user-growth
// @access  Private/Admin
const getUserGrowth = asyncHandler(async (req, res) => {
  const months = Math.min(Number(req.query.months) || 6, 24);
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const results = await User.aggregate([
    { $match: { schoolId: req.schoolId, createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          role: "$role",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Build a dense month-by-month series (including months with zero
  // registrations) so the chart doesn't have gaps.
  const series = [];
  const cursor = new Date(since);
  for (let i = 0; i < months; i++) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const label = cursor.toLocaleString("en-US", { month: "short", year: "2-digit" });

    const entry = { month: label, student: 0, teacher: 0, admin: 0 };
    results
      .filter((r) => r._id.year === year && r._id.month === month)
      .forEach((r) => {
        entry[r._id.role] = r.count;
      });

    series.push(entry);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  res.status(200).json({ success: true, series });
});

module.exports = { getDashboardStats, getRecentRegistrations, getUserGrowth };
