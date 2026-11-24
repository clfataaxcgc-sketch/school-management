const express = require("express");
const router = express.Router();
const {
  createTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  getMyTeacherProfile,
} = require("../controllers/teacherController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// Self-service route: a teacher fetching their own profile
router.get("/me", authorize("teacher"), getMyTeacherProfile);

// Everything else is admin-only
router.use(authorize("admin"));
router.route("/").get(getTeachers).post(createTeacher);
router.route("/:id").get(getTeacherById).put(updateTeacher).delete(deleteTeacher);

module.exports = router;
