const mongoose = require("mongoose");
const { ALL_ROLES } = require("../utils/roles");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Single collection for every role (admin, teacher, student, platform_owner). Role-specific data (grades,
// classes taught, children, etc) lives in separate collections from
// later phases that reference User by _id — this keeps auth simple
// while avoiding duplicating common profile fields per role.
const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      // "platform_owner" is the SaaS owner. It belongs to no school.
      enum: ALL_ROLES,
      required: true,
    },
    // Which school this user belongs to. Every user needs one, except the
    // platform owner (the SaaS owner), who is not part of any school.
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      index: true,
      required: function () {
        return this.role !== "platform_owner";
      },
    },
    profileImage: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    lastLogin: Date,
    passwordChangedAt: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

// Hash password whenever it's set or changed
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Strips sensitive fields before sending a user object to the client
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.__v;
  return obj;
};

// Generates a one-time token for the "forgot password" flow. The raw token
// is emailed to the user; only its hash is stored so a leaked DB doesn't
// let anyone reset accounts.
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const expireMinutes = Number(process.env.RESET_TOKEN_EXPIRE_MINUTES) || 30;
  this.resetPasswordExpire = Date.now() + expireMinutes * 60 * 1000;

  return resetToken;
};

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
