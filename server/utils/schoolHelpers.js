const ApiError = require("./ApiError");
const School = require("../models/School");

// Returns the school of a user, or throws if the user has no school or the
// school has been deactivated. Used by login and by the protect middleware,
// so a deactivated school cannot log in AND cannot keep using an old token.
const getActiveSchool = async (schoolId) => {
  if (!schoolId) {
    throw new ApiError(403, "This account is not linked to a school");
  }

  const school = await School.findById(schoolId);
  if (!school) {
    throw new ApiError(403, "School not found");
  }
  if (school.status !== "active") {
    throw new ApiError(403, "This school has been deactivated. Contact support.");
  }

  return school;
};

module.exports = { getActiveSchool };
