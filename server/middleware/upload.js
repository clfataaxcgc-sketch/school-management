const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

// Files are saved in one folder per school:
//   uploads/<schoolId>/assignments/...   uploads/<schoolId>/submissions/...
// The folder name comes from req.schoolId (the logged-in user's school),
// never from anything the client sends.
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
  ".txt", ".zip", ".png", ".jpg", ".jpeg", ".gif",
];

const makeStorage = (subdir) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_ROOT, String(req.schoolId), subdir);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${unique}${ext}`);
    },
  });

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type ${ext} is not allowed`));
  }
  cb(null, true);
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const uploadAssignmentFiles = multer({
  storage: makeStorage("assignments"),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
});

const uploadSubmissionFiles = multer({
  storage: makeStorage("submissions"),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
});

// Converts multer's req.files into the { url, originalName, size } shape
// the frontend stores on the Assignment/Submission attachments array. The
// URL is server-relative (not under /api — see server.js static mount).
const filesToAttachments = (files, subdir, schoolId) =>
  (files || []).map((f) => ({
    url: `/uploads/${schoolId}/${subdir}/${f.filename}`,
    originalName: f.originalname,
    size: f.size,
  }));

module.exports = {
  uploadAssignmentFiles,
  uploadSubmissionFiles,
  filesToAttachments,
};
