const express = require("express");
const router = express.Router();
const { registerSchool, getMySchool, updateMySchool } = require("../controllers/schoolController");
const { protect, authorize } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

// Public route: a new school signs up. authLimiter slows down bots.
router.post("/register", authLimiter, registerSchool);

// Private routes: the school of the logged-in user (taken from the token, not the url)
router.get("/me", protect, getMySchool);
router.put("/me", protect, authorize("admin"), updateMySchool);

module.exports = router;
