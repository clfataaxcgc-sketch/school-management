const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { filesToAttachments } = require("../middleware/upload");

// @desc    Upload one or more files for an assignment (teacher attaching
//          reference material)
// @route   POST /api/uploads/assignment
// @access  Private/Teacher or Admin
const uploadAssignmentAttachments = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) throw new ApiError(400, "No files uploaded");
  const attachments = filesToAttachments(req.files, "assignments", req.schoolId);
  res.status(201).json({ success: true, attachments });
});

// @desc    Upload one or more files for a submission (student attaching
//          their work)
// @route   POST /api/uploads/submission
// @access  Private/Student
const uploadSubmissionAttachments = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) throw new ApiError(400, "No files uploaded");
  const attachments = filesToAttachments(req.files, "submissions", req.schoolId);
  res.status(201).json({ success: true, attachments });
});

module.exports = { uploadAssignmentAttachments, uploadSubmissionAttachments };
