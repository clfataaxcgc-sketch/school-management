const express = require("express");
const router = express.Router();
const {
  takeAttendance,
  getSession,
  getClassReport,
  getStudentAttendance,
  getMyAttendance,
} = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/", authorize("teacher", "admin"), takeAttendance);
router.get("/session", authorize("teacher", "admin"), getSession);
router.get("/class/:classId/report", authorize("teacher", "admin"), getClassReport);
router.get("/me", authorize("student"), getMyAttendance);
router.get("/student/:studentId", authorize("admin", "teacher", "student"), getStudentAttendance);

module.exports = router;
