const express = require("express");
const router = express.Router();
const {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
} = require("../controllers/assignmentController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router
  .route("/")
  .get(authorize("admin", "teacher", "student"), getAssignments)
  .post(authorize("teacher", "admin"), createAssignment);

router
  .route("/:id")
  .get(authorize("admin", "teacher", "student"), getAssignmentById)
  .put(authorize("teacher", "admin"), updateAssignment)
  .delete(authorize("teacher", "admin"), deleteAssignment);

router.post("/:id/submit", authorize("student"), submitAssignment);
router.put("/:id/submissions/:submissionId/grade", authorize("teacher", "admin"), gradeSubmission);

module.exports = router;
