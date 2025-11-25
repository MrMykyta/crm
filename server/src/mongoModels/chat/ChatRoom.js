// src/mongoModels/chat/ChatRoom.js
const { mongoose } = require("../../db/mongo");
const { Schema } = mongoose;

const ParticipantSchema = new Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ["member", "admin"], default: "member" },

    lastReadMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    lastReadAt: { type: Date, default: null },
    mutedUntil: { type: Date, default: null },
  },
  { _id: false }
);

const ChatRoomSchema = new Schema(
  {
    companyId: { type: String, required: true },
    type: { type: String, enum: ["direct", "group"], required: true },

    participants: {
      type: [ParticipantSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 2,
        message: "ChatRoom must have at least 2 participants",
      },
    },

    title: { type: String, default: null },
    avatarUrl: { type: String, default: null },

    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: null },

    // последний закреп, чтобы быстро показывать «шапку», как в телеге
    lastPinnedMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    lastPinnedAt: {
      type: Date,
      default: null,
    },

    createdBy: { type: String, required: true },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "chat_rooms",
  }
);

ChatRoomSchema.index({ companyId: 1, updatedAt: -1 });

ChatRoomSchema.index(
  { companyId: 1, type: 1, "participants.userId": 1 },
  { name: "direct_room_by_company_and_users" }
);

// быстрый поиск комнат с закрепами
ChatRoomSchema.index({
  companyId: 1,
  lastPinnedAt: -1,
});

module.exports =
  mongoose.models.ChatRoom || mongoose.model("ChatRoom", ChatRoomSchema);