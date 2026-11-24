const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const School = require("../models/School");
const User = require("../models/User");
const { sendTokenResponse } = require("../utils/generateToken");

// @desc    Register a new school together with its first admin account
// @route   POST /api/schools/register
// @access  Public
const registerSchool = asyncHandler(async (req, res) => {
  const {
    schoolName,
    schoolEmail,
    schoolAddress,
    phone,
    firstName,
    lastName,
    email,
    password,
  } = req.body;

  // 1. Check the required fields
  if (!schoolName || !schoolEmail) {
    throw new ApiError(400, "schoolName and schoolEmail are required");
  }
  if (!firstName || !lastName || !email || !password) {
    throw new ApiError(400, "Admin firstName, lastName, email and password are required");
  }

  // Everything we use must be plain text (not an object or an array)
  const mustBeText = [schoolName, schoolEmail, firstName, lastName, email, password];
  if (!mustBeText.every((value) => typeof value === "string")) {
    throw new ApiError(400, "All fields must be text");
  }

  // 2. Make sure the school email and the admin email are not used already
  const schoolExists = await School.findOne({ schoolEmail: schoolEmail.toLowerCase() });
  if (schoolExists) {
    throw new ApiError(409, "A school with this email is already registered");
  }

  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    throw new ApiError(409, "An account with this email already exists");
  }

  // 3. Create the school
  const school = await School.create({
    schoolName,
    schoolEmail,
    schoolAddress,
    phone,
  });

  // 4. Create the first user. The role is always "admin" - we never take
  //    the role from the request body.
  let admin;
  try {
    admin = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      role: "admin",
      schoolId: school._id,
    });
  } catch (error) {
    // If the admin could not be created (for example a validation error),
    // remove the school so we do not leave an empty school behind.
    await School.findByIdAndDelete(school._id);
    throw error;
  }

  // 5. Log the new admin in (sets the cookie and returns the token)
  sendTokenResponse(admin, 201, res);
});

// @desc    Get the logged-in user's own school (name, logo, ...)
// @route   GET /api/schools/me
// @access  Private (any school role)
const getMySchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.schoolId);
  if (!school) throw new ApiError(404, "School not found");
  res.status(200).json({ success: true, school });
});

// @desc    Update the school profile. Only these fields can change - the
//          status can only be changed by the platform owner.
// @route   PUT /api/schools/me
// @access  Private/Admin
const updateMySchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.schoolId);
  if (!school) throw new ApiError(404, "School not found");

  ["schoolName", "schoolAddress", "phone", "logo"].forEach((field) => {
    if (req.body[field] !== undefined) school[field] = req.body[field];
  });
  await school.save();

  res.status(200).json({ success: true, school });
});

module.exports = { registerSchool, getMySchool, updateMySchool };
