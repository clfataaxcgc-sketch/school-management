const express = require("express");
const router = express.Router();
const {
  getContacts,
  getConversations,
  startConversation,
  getMessages,
  sendMessage,
  markConversationRead,
} = require("../controllers/messageController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/contacts", getContacts);
router.route("/conversations").get(getConversations).post(startConversation);
router.get("/conversations/:id/messages", getMessages);
router.post("/conversations/:id/messages", sendMessage);
router.put("/conversations/:id/read", markConversationRead);

module.exports = router;
