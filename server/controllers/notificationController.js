const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Notification = require("../models/Notification");

// @desc    List the current user's notifications, most recent first
// @route   GET /api/notifications?limit=
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ schoolId: req.schoolId, user: req.user._id }).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ schoolId: req.schoolId, user: req.user._id, read: false }),
  ]);

  res.status(200).json({ success: true, notifications, unreadCount });
});

// @desc    Mark one notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private (owner only)
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    schoolId: req.schoolId,
    user: req.user._id,
  });
  if (!notification) throw new ApiError(404, "Notification not found");

  notification.read = true;
  await notification.save();

  res.status(200).json({ success: true, notification });
});

// @desc    Mark every notification as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { schoolId: req.schoolId, user: req.user._id, read: false },
    { $set: { read: true } }
  );
  res.status(200).json({ success: true });
});

module.exports = { getNotifications, markRead, markAllRead };
