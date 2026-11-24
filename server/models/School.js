const mongoose = require("mongoose");

// One document per school (tenant). Every other model will point to this
// document through a "schoolId" field (added in Phase 2).
const schoolSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: [true, "School name is required"],
      trim: true,
      maxlength: 100,
    },
    schoolEmail: {
      type: String,
      required: [true, "School email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid school email"],
    },
    schoolAddress: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
      default: "",
    },
    // "inactive" schools will be blocked from using the app (Phase 4).
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model("School", schoolSchema);
