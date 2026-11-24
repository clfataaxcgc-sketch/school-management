const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const { getActiveSchool } = require("../utils/schoolHelpers");
const { ALL_ROLES } = require("../utils/roles");

// Reads the JWT from the httpOnly cookie or an Authorization: Bearer header,
// verifies it, and loads the user from the database.
const loadUserFromToken = async (req) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new ApiError(401, "Not authorized, no token provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new ApiError(401, "Not authorized, invalid or expired token");
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, "Not authorized, user no longer exists");
  }
  if (user.status !== "active") {
    throw new ApiError(403, "This account has been deactivated");
  }
  // Accounts with a role that no longer exists (old data) cannot use the app.
  if (!ALL_ROLES.includes(user.role)) {
    throw new ApiError(403, "This account type is no longer supported");
  }

  // Invalidate tokens issued before a password change
  if (user.passwordChangedAt) {
    const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (decoded.iat < changedTimestamp) {
      throw new ApiError(401, "Password recently changed, please log in again");
    }
  }

  return { user, decoded };
};

// Extra checks for users that belong to a school (admin, teacher, student).
const checkSchoolUser = async (user, decoded) => {
  // Tokens made before multi-tenant support have no schoolId: log in again.
  if (!decoded.schoolId) {
    throw new ApiError(401, "Please log in again");
  }
  // The schoolId inside the token must match the one saved on the user.
  if (String(decoded.schoolId) !== String(user.schoolId)) {
    throw new ApiError(401, "Not authorized, invalid token");
  }
  // Blocks users of deactivated schools, even if their token is still valid.
  await getActiveSchool(user.schoolId);
};

// For every SCHOOL route (students, classes, grades, ...).
// Platform owners are refused here: they have no school, so a school route
// would have no schoolId to filter with.
// After this middleware, controllers use req.schoolId (taken from the
// database user), never a schoolId sent by the frontend.
const protect = asyncHandler(async (req, res, next) => {
  const { user, decoded } = await loadUserFromToken(req);

  if (user.role === "platform_owner") {
    throw new ApiError(403, "Platform owner accounts cannot use school features");
  }
  await checkSchoolUser(user, decoded);

  req.user = user;
  req.schoolId = user.schoolId;
  next();
});

// For the platform owner dashboard (/api/platform/*). No school is involved.
const protectPlatformOwner = asyncHandler(async (req, res, next) => {
  const { user } = await loadUserFromToken(req);

  if (user.role !== "platform_owner") {
    throw new ApiError(403, "Only the platform owner can do this");
  }

  req.user = user;
  next();
});

// For the few routes every kind of account may use (me, logout, change password).
// School users get the same checks as protect; the platform owner has no school.
const protectAnyUser = asyncHandler(async (req, res, next) => {
  const { user, decoded } = await loadUserFromToken(req);

  if (user.role !== "platform_owner") {
    await checkSchoolUser(user, decoded);
    req.schoolId = user.schoolId;
  }

  req.user = user;
  next();
});

// Role-based access control: authorize("admin"), authorize("admin", "teacher"), etc.
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Not authorized");
  }
  if (!roles.includes(req.user.role)) {
    throw new ApiError(
      403,
      `Role '${req.user.role}' is not permitted to perform this action`
    );
  }
  next();
};

module.exports = { protect, protectPlatformOwner, protectAnyUser, authorize };
