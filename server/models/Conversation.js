const mongoose = require("mongoose");

// A 1:1 conversation. `participants` always holds exactly 2 User ids —
// group chat isn't part of the spec (Student↔Teacher and
// Admin↔Teacher are both pairwise). lastMessage is denormalized
// so the conversation list can render previews without a join per row.
const conversationSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessage: {
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: Date,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
