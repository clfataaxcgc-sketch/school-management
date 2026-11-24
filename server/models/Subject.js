const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// Name and code must be unique inside one school only.
subjectSchema.index({ schoolId: 1, name: 1 }, { unique: true });
subjectSchema.index({ schoolId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Subject", subjectSchema);
