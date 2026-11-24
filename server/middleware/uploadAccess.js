// Guards the /uploads static folder (used in server.js after protect).
// Files live in uploads/<schoolId>/..., and a user may only open files inside
// their own school's folder.
const onlyOwnSchoolFiles = (req, res, next) => {
  const folderInUrl = req.path.split("/")[1];
  // ".." is refused too, as a second layer on top of express.static's own check.
  if (!req.schoolId || folderInUrl !== String(req.schoolId) || req.path.includes("..")) {
    return res.status(403).json({ success: false, message: "Not allowed to open this file" });
  }
  next();
};

module.exports = { onlyOwnSchoolFiles };
