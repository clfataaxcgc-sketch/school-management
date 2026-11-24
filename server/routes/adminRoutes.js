const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getRecentRegistrations,
  getUserGrowth,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");

// Every route in this file is admin-only
router.use(protect, authorize("admin"));

router.get("/stats", getDashboardStats);
router.get("/recent-registrations", getRecentRegistrations);
router.get("/user-growth", getUserGrowth);

module.exports = router;
