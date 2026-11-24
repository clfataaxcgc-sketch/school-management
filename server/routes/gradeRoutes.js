const express = require("express");
const router = express.Router();
const {
  upsertGrade,
  bulkUpsertGrades,
  getClassGrades,
  getStudentGrades,
  getMyGrades,
} = require("../controllers/gradeController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.put("/", authorize("teacher", "admin"), upsertGrade);
router.put("/bulk", authorize("teacher", "admin"), bulkUpsertGrades);
router.get("/class/:classId/report", authorize("teacher", "admin"), getClassGrades);
router.get("/me", authorize("student"), getMyGrades);
router.get("/student/:studentId", authorize("admin", "teacher", "student"), getStudentGrades);

module.exports = router;
