const mongoose = require("mongoose");

// A single scored component (Assignment / Quiz / Midterm / Final). score is
// null until the teacher enters it — an ungraded component is simply
// excluded from the summary calculations rather than treated as zero.
const componentSchema = new mongoose.Schema(
  {
    score: { type: Number, default: null, min: 0 },
    maxScore: { type: Number, default: null, min: 1 },
  },
  { _id: false }
);

// One gradebook entry per student, per subject, per class — matches the
// spec's example of a single "Mathematics" record per student holding
// Assignment/Quiz/Midterm/Final scores. Totals/percentage/letter are never
// stored; they're derived on read (see utils/gradeCalculations.js) so they
// can't drift from the underlying scores.
const gradeSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
    components: {
      assignment: { type: componentSchema, default: () => ({}) },
      quiz: { type: componentSchema, default: () => ({}) },
      midterm: { type: componentSchema, default: () => ({}) },
      final: { type: componentSchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

gradeSchema.index({ schoolId: 1, student: 1, subject: 1, class: 1 }, { unique: true });

module.exports = mongoose.model("Grade", gradeSchema);
