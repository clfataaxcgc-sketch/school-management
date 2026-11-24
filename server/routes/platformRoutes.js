const express = require("express");
const router = express.Router();
const {
  getPlatformStats,
  getSchools,
  getSchoolById,
  updateSchoolStatus,
} = require("../controllers/platformController");
const { protectPlatformOwner, authorize } = require("../middleware/auth");

// Every route in this file is for the platform owner only.
router.use(protectPlatformOwner, authorize("platform_owner"));

router.get("/stats", getPlatformStats);
router.get("/schools", getSchools);
router.get("/schools/:id", getSchoolById);
router.patch("/schools/:id/status", updateSchoolStatus);

module.exports = router;
