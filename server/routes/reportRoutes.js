const express = require("express");
const router = express.Router();
const {
  getAttendanceTrend,
  getGradeDistribution,
  getClassComparison,
  exportAttendanceCsv,
  exportGradesCsv,
} = require("../controllers/reportController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin", "teacher"));

router.get("/attendance-trend", getAttendanceTrend);
router.get("/grade-distribution", getGradeDistribution);
router.get("/class-comparison", getClassComparison);
router.get("/attendance/export", exportAttendanceCsv);
router.get("/grades/export", exportGradesCsv);

module.exports = router;
