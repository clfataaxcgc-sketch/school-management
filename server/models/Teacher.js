const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    employeeId: {
      type: String,
      required: true,
      trim: true,
    },
    // Populated once Subject/Class models exist (Phase 4). Empty until then.
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    dateOfJoining: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Unique inside one school only.
teacherSchema.index({ schoolId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model("Teacher", teacherSchema);
