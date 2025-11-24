const { mongoose } = require('../../db/mongo');
const { Schema } = mongoose;

const AttachmentSchema = new Schema(
  {
    type: { type: String, enum: ['file', 'image', 'audio', 'video'], default: 'file' },
    url: { type: String, required: true },
    name: { type: String, default: null },
    size: { type: Number, default: null },
    mimeType: { type: String, default: null },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true, index: true },
    companyId: { type: String, required: true },

    authorId: { type: String, required: true },

    text: { type: String, default: '' },
    attachments: { type: [AttachmentSchema], default: [] },

    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
    },

    // 👇 НОВОЕ: переслано с другого сообщения
    forwardFromMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
    },

    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },

    isSystem: { type: Boolean, default: false },

    // сюда будем класть snapshot исходного сообщения при пересылке
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'chat_messages',
  }
);

// Индексы
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
ChatMessageSchema.index({ companyId: 1, text: 'text' });

module.exports =
  mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);