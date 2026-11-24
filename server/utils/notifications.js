const Notification = require("../models/Notification");
const { getIO } = require("./socket");

// Saves a notification and, if the recipient has an active socket
// connection, pushes it in real time. Safe to call even when Socket.IO
// hasn't initialized (e.g. in tests) — it just skips the push.
// schoolId is required: every notification belongs to one school.
const createNotification = async ({ schoolId, userId, type, title, body, link }) => {
  const notification = await Notification.create({ schoolId, user: userId, type, title, body, link });
  const io = getIO();
  if (io) io.to(`user:${userId}`).emit("notification", notification);
  return notification;
};

module.exports = { createNotification };
