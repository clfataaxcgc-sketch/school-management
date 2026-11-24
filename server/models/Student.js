const mongoose = require("mongoose");

// Holds only academic/student-specific fields. Common profile fields
// (name, email, phone, profileImage, status) live on User — see
// server/models/User.js — to avoid duplicating them per role.
const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    // Populated once the Class model exists (Phase 4). Left null until then.
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },
    admissionDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Two schools may use the same studentId, but not inside one school.
studentSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
