// src/mongoModels/chat/ChatReaction.js
// Reaction model for chat messages (stored per user + emoji).
const { mongoose } = require("../../db/mongo");
const { Schema } = mongoose;

const ChatReactionSchema = new Schema(
  {
    // Message this reaction belongs to.
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      required: true,
      index: true,
    },
    // Room for quick access control / filtering.
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    // Company scope (multi-tenant).
    companyId: { type: String, required: true, index: true },
    // Actor user id (string from auth).
    userId: { type: String, required: true, index: true },
    // Emoji as a string (not enum).
    emoji: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "chat_reactions",
  }
);

// Ensure one emoji per user per message.
ChatReactionSchema.index(
  { messageId: 1, emoji: 1, userId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.ChatReaction ||
  mongoose.model("ChatReaction", ChatReactionSchema);
