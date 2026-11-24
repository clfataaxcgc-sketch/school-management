const express = require("express");
const router = express.Router();
const {
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protectAnyUser } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

router.post("/login", authLimiter, login);
router.post("/logout", protectAnyUser, logout);
router.get("/me", protectAnyUser, getMe);
router.put("/profile", protectAnyUser, updateProfile);
router.put("/change-password", protectAnyUser, changePassword);
router.post("/forgot-password", authLimiter, forgotPassword);
router.put("/reset-password/:token", authLimiter, resetPassword);

module.exports = router;
