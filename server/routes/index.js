const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const schoolRoutes = require("./schoolRoutes");
const platformRoutes = require("./platformRoutes");
const adminRoutes = require("./adminRoutes");
const studentRoutes = require("./studentRoutes");
const teacherRoutes = require("./teacherRoutes");
const subjectRoutes = require("./subjectRoutes");
const classRoutes = require("./classRoutes");
const attendanceRoutes = require("./attendanceRoutes");
const assignmentRoutes = require("./assignmentRoutes");
const uploadRoutes = require("./uploadRoutes");
const gradeRoutes = require("./gradeRoutes");
const messageRoutes = require("./messageRoutes");
const notificationRoutes = require("./notificationRoutes");
const reportRoutes = require("./reportRoutes");

router.use("/auth", authRoutes);
router.use("/schools", schoolRoutes);
router.use("/platform", platformRoutes);
router.use("/admin", adminRoutes);
router.use("/students", studentRoutes);
router.use("/teachers", teacherRoutes);
router.use("/subjects", subjectRoutes);
router.use("/classes", classRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/assignments", assignmentRoutes);
router.use("/uploads", uploadRoutes);
router.use("/grades", gradeRoutes);
router.use("/messages", messageRoutes);
router.use("/notifications", notificationRoutes);
router.use("/reports", reportRoutes);

// Lightweight role-ping endpoints kept from Phase 1 for teacher/student
// so RBAC can still be smoke-tested before their own dashboards get real data.
const { protect, authorize } = require("../middleware/auth");
router.get("/teacher/ping", protect, authorize("teacher"), (req, res) =>
  res.json({ success: true, message: `Welcome, teacher ${req.user.firstName}` })
);
router.get("/student/ping", protect, authorize("student"), (req, res) =>
  res.json({ success: true, message: `Welcome, student ${req.user.firstName}` })
);

module.exports = router;
