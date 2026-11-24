const express = require("express");
const router = express.Router();
const {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
} = require("../controllers/subjectController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect, authorize("admin"));

router.route("/").get(getSubjects).post(createSubject);
router.route("/:id").get(getSubjectById).put(updateSubject).delete(deleteSubject);

module.exports = router;
