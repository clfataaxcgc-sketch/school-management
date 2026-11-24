// One-time script for databases that already have data from the
// single-school version of the app.
//
//   node utils/migrateToMultiTenant.js
//
// What it does:
//   1. Creates a "default" school (if none exists yet).
//   2. Gives every existing record that has no schoolId to that school.
//   3. Rebuilds each collection's indexes so the old global unique
//      indexes (like Class.name) are replaced by per-school ones.
//   4. Moves old uploaded files into uploads/<defaultSchoolId>/ and fixes
//      the attachment urls stored on assignments and submissions.
//
// It is safe to run more than once.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const School = require("../models/School");
const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Grade = require("../models/Grade");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

const modelsToMigrate = [
  User, Student, Teacher, Class, Subject, Attendance,
  Assignment, Submission, Grade, Conversation, Message, Notification,
];

// Finds the default school, or creates it the first time the script runs.
const getDefaultSchool = async () => {
  const existing = await School.findOne({ schoolEmail: "default@school.local" });
  if (existing) return existing;

  return School.create({
    schoolName: "Default School",
    schoolEmail: "default@school.local",
  });
};

// Step 4: old files lived in uploads/assignments and uploads/submissions.
// Files are now private per school, so move them into the default school's
// folder and update the saved urls.
const moveOldUploads = async (schoolId) => {
  const uploadRoot = path.join(__dirname, "..", "uploads");

  for (const subdir of ["assignments", "submissions"]) {
    const oldDir = path.join(uploadRoot, subdir);
    const newDir = path.join(uploadRoot, String(schoolId), subdir);
    if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
      fs.mkdirSync(path.dirname(newDir), { recursive: true });
      fs.renameSync(oldDir, newDir);
      console.log(`Moved ${oldDir} -> ${newDir}`);
    }
  }

  for (const Model of [Assignment, Submission]) {
    const docs = await Model.find({ "attachments.url": /^\/uploads\/(assignments|submissions)\// });
    for (const doc of docs) {
      doc.attachments.forEach((file) => {
        file.url = file.url.replace(/^\/uploads\//, `/uploads/${schoolId}/`);
      });
      await doc.save();
    }
    console.log(`${Model.modelName}: ${docs.length} documents got new attachment urls`);
  }
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const defaultSchool = await getDefaultSchool();
  console.log(`Default school id: ${defaultSchool._id}`);

  for (const Model of modelsToMigrate) {
    // Step 2: only touch records that do not have a schoolId yet.
    const result = await Model.updateMany(
      { schoolId: { $exists: false } },
      { $set: { schoolId: defaultSchool._id } }
    );
    console.log(`${Model.modelName}: ${result.modifiedCount} records updated`);

    // Step 3: drop indexes that are not in the schema anymore and create
    // the new per-school ones.
    await Model.syncIndexes();
    console.log(`${Model.modelName}: indexes synced`);
  }

  await moveOldUploads(defaultSchool._id);

  await mongoose.disconnect();
  console.log("Done");
};

run().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
