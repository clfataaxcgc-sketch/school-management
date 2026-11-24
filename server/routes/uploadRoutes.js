const express = require("express");
const router = express.Router();
const { uploadAssignmentAttachments, uploadSubmissionAttachments } = require("../controllers/uploadController");
const { uploadAssignmentFiles, uploadSubmissionFiles } = require("../middleware/upload");
const { protect, authorize } = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/rateLimiter");

router.use(protect, uploadLimiter);

router.post(
  "/assignment",
  authorize("teacher", "admin"),
  uploadAssignmentFiles.array("files", 5),
  uploadAssignmentAttachments
);

router.post(
  "/submission",
  authorize("student"),
  uploadSubmissionFiles.array("files", 5),
  uploadSubmissionAttachments
);

module.exports = router;
