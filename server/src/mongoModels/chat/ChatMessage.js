// src/mongoModels/chat/ChatMessage.js
const { mongoose } = require("../../db/mongo");
const { Schema } = mongoose;

const AttachmentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["file", "image", "audio", "video"],
      default: "file",
    },
    url: { type: String, required: true },
    name: { type: String, default: null },
    size: { type: Number, default: null },
    mimeType: { type: String, default: null },
  },
  { _id: false }
);

// простая forward-структура: Mixed, чтобы не ебаться с миграциями,
// и по умолчанию = null → !!m.forward === false, если не переслано
const ChatMessageSchema = new Schema(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    companyId: { type: String, required: true },

    authorId: { type: String, required: true },

    text: { type: String, default: "" },
    attachments: { type: [AttachmentSchema], default: [] },

    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },

    // 👇 переслано (snapshot)
    // forward = null → НЕ пересланное
    // forward = {
    //   sourceMessageId,     // сообщение, которое пересылали (может само быть forward)
    //   originalMessageId,   // самый первый оригинал в цепочке
    //   originalAuthorId,
    //   originalAuthorName,  // можно не заполнять, фронт добьёт по users
    //   textSnippet          // обрезанный текст оригинала (для превью / lastMessage)
    // }
    forward: {
      type: Schema.Types.Mixed,
      default: null,
    },

    // 👇 для сохранения порядка внутри пачки пересылки
    forwardBatchId: {
      type: String,
      default: null,
      index: true,
    },
    forwardBatchSeq: {
      type: Number,
      default: null,
    },

    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },

    isSystem: { type: Boolean, default: false },

    meta: { type: Schema.Types.Mixed, default: {} },

    // ---------- PINNED ----------
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    pinnedAt: {
      type: Date,
      default: null,
      index: true,
    },
    pinnedBy: { type: String},
  },
  {
    timestamps: true,
    collection: "chat_messages",
  }
);

// Индексы
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
ChatMessageSchema.index({ companyId: 1, text: "text" });

// для быстрых выборок закреплённых
ChatMessageSchema.index({
  roomId: 1,
  isPinned: 1,
  pinnedAt: -1,
  createdAt: -1,
});

module.exports =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", ChatMessageSchema);