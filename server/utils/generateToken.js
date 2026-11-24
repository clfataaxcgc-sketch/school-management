const jwt = require("jsonwebtoken");

// Creates a signed JWT carrying the user id, role and schoolId.
// NOTE: the protect middleware does not trust these values on their own -
// it loads the user from the database and compares them.
const generateToken = (id, role, schoolId) => {
  return jwt.sign({ id, role, schoolId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// Attaches the JWT as an httpOnly cookie AND returns it in the JSON body,
// so the frontend can work with either cookie-based or bearer-token auth.
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role, user.schoolId);

  const cookieExpireDays = Number(process.env.JWT_COOKIE_EXPIRE) || 7;
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      token,
      user: user.toSafeObject(),
    });
};

module.exports = { generateToken, sendTokenResponse };
