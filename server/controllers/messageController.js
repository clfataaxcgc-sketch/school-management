const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { getAllowedContacts } = require("../utils/messagingContacts");
const { createNotification } = require("../utils/notifications");
const { getIO, isOnline } = require("../utils/socket");

// @desc    List people the current user is allowed to start a conversation
//          with (Student↔Teacher and Admin↔Teacher pairs)
// @route   GET /api/messages/contacts
// @access  Private
const getContacts = asyncHandler(async (req, res) => {
  const contacts = await getAllowedContacts(req.user);
  const withPresence = contacts.map((c) => ({ ...c, online: isOnline(c.userId.toString()) }));
  res.status(200).json({ success: true, contacts: withPresence });
});

// @desc    List the current user's conversations, most recently active
//          first, each with an unread count
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ schoolId: req.schoolId, participants: req.user._id })
    .populate("participants", "firstName lastName role profileImage")
    .sort({ updatedAt: -1 });

  const withUnread = await Promise.all(
    conversations.map(async (c) => {
      const otherParticipant = c.participants.find((p) => p._id.toString() !== req.user._id.toString());
      const unreadCount = await Message.countDocuments({
        schoolId: req.schoolId,
        conversation: c._id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      });
      return {
        _id: c._id,
        otherParticipant,
        lastMessage: c.lastMessage,
        unreadCount,
        online: otherParticipant ? isOnline(otherParticipant._id.toString()) : false,
      };
    })
  );

  res.status(200).json({ success: true, conversations: withUnread });
});

// @desc    Start (or fetch the existing) conversation with an allowed contact
// @route   POST /api/messages/conversations
// @access  Private
const startConversation = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) throw new ApiError(400, "userId is required");
  if (userId === req.user._id.toString()) throw new ApiError(400, "You cannot message yourself");

  const contacts = await getAllowedContacts(req.user);
  const allowed = contacts.some((c) => c.userId.toString() === userId);
  if (!allowed) throw new ApiError(403, "You are not allowed to message this person");

  let conversation = await Conversation.findOne({
    schoolId: req.schoolId,
    participants: { $all: [req.user._id, userId], $size: 2 },
  }).populate("participants", "firstName lastName role profileImage");

  if (!conversation) {
    conversation = await Conversation.create({
      schoolId: req.schoolId,
      participants: [req.user._id, userId],
    });
    await conversation.populate("participants", "firstName lastName role profileImage");
  }

  res.status(200).json({ success: true, conversation });
});

// @desc    Get messages in a conversation (most recent 100, oldest first)
// @route   GET /api/messages/conversations/:id/messages
// @access  Private (participant only)
const getMessages = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!conversation) throw new ApiError(404, "Conversation not found");
  if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
    throw new ApiError(403, "Not a participant in this conversation");
  }

  const messages = await Message.find({ schoolId: req.schoolId, conversation: conversation._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .then((msgs) => msgs.reverse());

  res.status(200).json({ success: true, messages });
});

// @desc    Send a message in a conversation (persists, notifies, and
//          pushes it live over the recipient's socket)
// @route   POST /api/messages/conversations/:id/messages
// @access  Private (participant only)
const sendMessage = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) throw new ApiError(400, "Message text is required");

  const conversation = await Conversation.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!conversation) throw new ApiError(404, "Conversation not found");
  if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
    throw new ApiError(403, "Not a participant in this conversation");
  }

  const message = await Message.create({
    schoolId: req.schoolId,
    conversation: conversation._id,
    sender: req.user._id,
    text: text.trim(),
    readBy: [req.user._id],
  });

  conversation.lastMessage = { text: message.text, sender: req.user._id, createdAt: message.createdAt };
  await conversation.save();

  const recipientId = conversation.participants.find((p) => p.toString() !== req.user._id.toString());

  const io = getIO();
  if (io && recipientId) {
    io.to(`user:${recipientId}`).emit("new_message", { conversationId: conversation._id, message });
  }

  if (recipientId) {
    await createNotification({
      schoolId: req.schoolId,
      userId: recipientId,
      type: "message",
      title: `New message from ${req.user.firstName} ${req.user.lastName}`,
      body: message.text.slice(0, 100),
      link: "/messages",
    });
  }

  res.status(201).json({ success: true, message });
});

// @desc    Mark every message in a conversation as read by the current user
// @route   PUT /api/messages/conversations/:id/read
// @access  Private (participant only)
const markConversationRead = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!conversation) throw new ApiError(404, "Conversation not found");
  if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
    throw new ApiError(403, "Not a participant in this conversation");
  }

  await Message.updateMany(
    {
      schoolId: req.schoolId,
      conversation: conversation._id,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
    },
    { $addToSet: { readBy: req.user._id } }
  );

  res.status(200).json({ success: true });
});

module.exports = {
  getContacts,
  getConversations,
  startConversation,
  getMessages,
  sendMessage,
  markConversationRead,
};
