const express = require("express");
const router = express.Router();
const {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  updateClassSubjects,
  updateClassStudents,
  deleteClass,
} = require("../controllers/classController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin"));

router.route("/").get(getClasses).post(createClass);
router.route("/:id").get(getClassById).put(updateClass).delete(deleteClass);
router.put("/:id/subjects", updateClassSubjects);
router.put("/:id/students", updateClassStudents);

module.exports = router;
