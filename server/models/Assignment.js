const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  { url: String, originalName: String, size: Number },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: [true, "Title is required"], trim: true },
    description: { type: String, trim: true, maxlength: 3000 },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    // The subject-teacher who owns this assignment (null if an admin
    // created it for a subject with no teacher assigned yet).
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
    dueDate: { type: Date, required: true },
    maxPoints: { type: Number, default: 100, min: 1 },
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

assignmentSchema.index({ schoolId: 1, class: 1, subject: 1, dueDate: -1 });

module.exports = mongoose.model("Assignment", assignmentSchema);
