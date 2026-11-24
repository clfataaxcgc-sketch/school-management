const mongoose = require("mongoose");

// One document per (class, subject, date) "session" — matches how
// attendance is actually taken (a teacher marks a whole class at once for
// one subject on one day) and keeps the roster's statuses together instead
// of scattering one row per student across the collection.
const attendanceRecordSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      required: true,
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    date: { type: Date, required: true },
    // Who took/last edited this session. Null if an admin took it and no
    // subject-teacher was assigned in Class.subjects at the time.
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
    records: [attendanceRecordSchema],
  },
  { timestamps: true }
);

// One session per class+subject+day
attendanceSchema.index({ schoolId: 1, class: 1, subject: 1, date: 1 }, { unique: true });
attendanceSchema.index({ "records.student": 1, date: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
