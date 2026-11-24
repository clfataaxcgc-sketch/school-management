const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  { url: String, originalName: String, size: Number },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    textResponse: { type: String, trim: true, maxlength: 5000 },
    attachments: [attachmentSchema],
    submittedAt: { type: Date, default: Date.now },
    // "pending" (no submission yet) is never stored — it's the implicit
    // state when no Submission document exists for a student+assignment.
    status: {
      type: String,
      enum: ["submitted", "late", "graded"],
      required: true,
    },
    grade: { type: Number, min: 0, default: null },
    feedback: { type: String, trim: true, maxlength: 2000 },
    gradedAt: Date,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
  },
  { timestamps: true }
);

// One submission per student per assignment — resubmitting before grading
// updates this same document rather than creating duplicates.
submissionSchema.index({ schoolId: 1, assignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Submission", submissionSchema);
