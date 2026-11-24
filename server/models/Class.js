const mongoose = require("mongoose");

// Which teacher teaches which subject *for this specific class* — e.g.
// Mr. Ahmed teaches Mathematics in Grade 10A, but Ms. Lee teaches it in
// Grade 9B. Kept as an embedded array on Class rather than a separate
// collection since it's always queried in the context of one class.
const classSubjectSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
  },
  { _id: false }
);

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true, // e.g. "Grade 10A"
    },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Homeroom / class teacher (distinct from per-subject teachers below)
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    subjects: [classSubjectSchema],
    academicYear: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Students are NOT stored as an array here — Student.class is the single
// source of truth for the class↔student relationship, queried on demand,
// so the two can't drift out of sync.

// Class names must be unique inside one school only.
classSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Class", classSchema);
