'use strict';

const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const ApplicationError = require('../../errors/ApplicationError');
const { mongoose } = require('../../db/mongo');
const {
  File,
  UserCompany,
  Company,
  Counterparty,
  Product,
  Deal,
  Task,
  Order,
  Offer,
  Contact,
  Department,
  Brand,
} = require('../../models');
const ChatMessage = require('../../mongoModels/chat/ChatMessage');
const ChatRoom = require('../../mongoModels/chat/ChatRoom');
const {
  PRIVATE_ROOT,
  PUBLIC_ROOT,
  TMP_ROOT,
  MAX_SIZE_BYTES,
  PUBLIC_ENABLED,
} = require('../../config/files');

const OWNER_TYPES = new Set([
  'user',
  'company',
  'counterparty',
  'product',
  'deal',
  'task',
  'order',
  'offer',
  'contact',
  'department',
  'chatMessage',
  'chatmessage',
  'brand',
]);

const PURPOSES = new Set([
  'avatar',
  'background',
  'logo',
  'product_image',
  'website_asset',
  'chat_attachment',
  'document',
  'media',
  'other',
  'file',
]);

const VISIBILITY = new Set(['private', 'public']);

// Public visibility whitelist (spec-driven)
const PUBLIC_WHITELIST = new Set([
  'product:product_image',
  'brand:website_asset',
  'company:website_asset',
]);

const IMAGE_PURPOSES = new Set([
  'avatar',
  'background',
  'logo',
  'product_image',
  'website_asset',
]);

const IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const CHAT_ATTACHMENT_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'video/mp4',
  'video/webm',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const FILE_MIME = new Set([
  'text/plain',
  'text/csv',
  'application/json',
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'video/webm',
]);

function ensureDir(dir) {
  return fs.mkdir(dir, { recursive: true });
}

function safeBaseName(original = '') {
  const ext = path.extname(original).toLowerCase().slice(0, 10);
  const rnd = crypto.randomBytes(6).toString('hex');
  return `${Date.now()}-${rnd}${ext}`;
}

function makePublicKey() {
  return crypto.randomBytes(16).toString('hex');
}

function isSystemPrivileged(user) {
  const role = user?.role || null;
  return role === 'admin' || role === 'owner';
}

function isChatMessageOwnerType(ownerType) {
  return String(ownerType || '').toLowerCase() === 'chatmessage';
}

function normalizeOwnerType(ownerType) {
  const lower = String(ownerType || '').trim().toLowerCase();
  if (!lower) return '';
  return lower === 'chatmessage' ? 'chatMessage' : lower;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function hasPermission(user, perm) {
  const allow = user?.permissions?.allow || [];
  const deny = user?.permissions?.deny || [];
  if (Array.isArray(deny) && deny.includes(perm)) return false;
  if (Array.isArray(allow) && allow.length) return allow.includes(perm);
  // если ACL не настроен — не блокируем доступ по умолчанию
  return true;
}

function canUploadByPolicy({ user, ownerType, ownerId }) {
  if (isSystemPrivileged(user)) return true;
  if (ownerType === 'user' && String(ownerId) === String(user?.id)) return true;

  if (ownerType === 'company') {
    return hasPermission(user, 'company:update') || hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
  }

  if (ownerType === 'brand' || ownerType === 'product') {
    return hasPermission(user, 'product:update') || hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
  }

  if (ownerType === 'counterparty') {
    return hasPermission(user, 'counterparty:update') || hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
  }

  if (ownerType === 'deal') {
    return hasPermission(user, 'deal:update') || hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
  }

  if (ownerType === 'task') {
    return hasPermission(user, 'task:update') || hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
  }

  if (ownerType === 'order') {
    return hasPermission(user, 'order:update') || hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
  }

  if (ownerType === 'offer') {
    return hasPermission(user, 'offer:update') || hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
  }

  if (ownerType === 'contact' || ownerType === 'department') {
    return hasPermission(user, 'contact:update') || hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
  }

  // chat attachments — права на доступ контролируются membership-ом
  if (isChatMessageOwnerType(ownerType)) return true;

  return hasPermission(user, 'file:upload') || hasPermission(user, 'attachment:upload');
}

function canDeleteByPolicy({ user, file }) {
  if (!user || !file) return false;
  if (isSystemPrivileged(user)) return true;
  if (file.visibility === 'public') return false;
  return String(file.uploadedBy) === String(user.id);
}

function assertVisibilityAllowed(ownerType, purpose, visibility) {
  if (!VISIBILITY.has(visibility)) {
    throw new ApplicationError('VALIDATION_ERROR: invalid visibility', 400);
  }
  if (visibility === 'public') {
    if (!PUBLIC_ENABLED) {
      throw new ApplicationError('VALIDATION_ERROR: public files disabled', 400);
    }
    const key = `${ownerType}:${purpose}`;
    if (!PUBLIC_WHITELIST.has(key)) {
      throw new ApplicationError('VALIDATION_ERROR: public visibility not allowed', 400);
    }
  }
}

function assertMimeAllowed(purpose, mime) {
  if (!mime) {
    throw new ApplicationError('VALIDATION_ERROR: mime is required', 400);
  }
  if (purpose === 'chat_attachment') {
    if (!CHAT_ATTACHMENT_MIME.has(mime)) {
      throw new ApplicationError('VALIDATION_ERROR: attachment mime not allowed', 415);
    }
    return;
  }
  if (IMAGE_PURPOSES.has(purpose)) {
    if (!IMAGE_MIME.has(mime)) {
      throw new ApplicationError('VALIDATION_ERROR: image mime not allowed', 415);
    }
    return;
  }
  if (!FILE_MIME.has(mime)) {
    throw new ApplicationError('VALIDATION_ERROR: file mime not allowed', 415);
  }
}

async function assertOwnerInCompany({ ownerType, ownerId, companyId, userId }) {
  if (!OWNER_TYPES.has(ownerType)) {
    throw new ApplicationError('VALIDATION_ERROR: invalid ownerType', 400);
  }

  // SQL owners
  const assertByModel = async (Model, name) => {
    if (!Model) {
      throw new ApplicationError(`Owner model not configured: ${name}`, 500);
    }
    if (!ownerId) throw new ApplicationError(`${name} ownerId required`, 400);
    if (!isUuid(ownerId)) {
      throw new ApplicationError('VALIDATION_ERROR: invalid ownerId', 400);
    }
    const row = await Model.findOne({ where: { id: ownerId, companyId } });
    if (!row) throw new ApplicationError(`${name} not found`, 404);
    return row;
  };

  if (ownerType === 'user') {
    if (!isUuid(ownerId)) {
      throw new ApplicationError('VALIDATION_ERROR: invalid ownerId', 400);
    }
    const membership = await UserCompany.findOne({ where: { userId: ownerId, companyId } });
    if (!membership) throw new ApplicationError('User not in company', 404);
    return membership;
  }

  if (ownerType === 'company') {
    if (!isUuid(ownerId)) {
      throw new ApplicationError('VALIDATION_ERROR: invalid ownerId', 400);
    }
    if (String(ownerId) !== String(companyId)) {
      throw new ApplicationError('Company scope mismatch', 403);
    }
    const row = await Company.findOne({ where: { id: ownerId } });
    if (!row) throw new ApplicationError('Company not found', 404);
    return row;
  }

  if (ownerType === 'counterparty') return assertByModel(Counterparty, 'Counterparty');
  if (ownerType === 'product') return assertByModel(Product, 'Product');
  if (ownerType === 'deal') return assertByModel(Deal, 'Deal');
  if (ownerType === 'task') return assertByModel(Task, 'Task');
  if (ownerType === 'order') return assertByModel(Order, 'Order');
  if (ownerType === 'offer') return assertByModel(Offer, 'Offer');
  if (ownerType === 'contact') return assertByModel(Contact, 'Contact');
  if (ownerType === 'department') return assertByModel(Department, 'Department');
  if (ownerType === 'brand') return assertByModel(Brand, 'Brand');

  if (isChatMessageOwnerType(ownerType)) {
    if (!mongoose.isValidObjectId(ownerId)) {
      throw new ApplicationError('Chat room not found', 404);
    }
    const room = await ChatRoom.findOne({
      _id: ownerId,
      companyId,
      'participants.userId': String(userId),
      isDeleted: false,
    });
    if (!room) throw new ApplicationError('Chat access denied', 403);
    return room;
  }

  throw new ApplicationError('Unsupported ownerType', 400);
}

function buildStoragePath({ companyId, ownerType, ownerId, fileId, safeName, visibility, publicKey }) {
  if (visibility === 'public') {
    const filename = `${publicKey}_${safeName}`;
    return {
      absPath: path.join(PUBLIC_ROOT, filename),
      storagePath: path.posix.join('public-uploads', filename),
    };
  }

  const dir = path.join(PRIVATE_ROOT, String(companyId), ownerType, String(ownerId));
  const filename = `${fileId}_${safeName}`;
  return {
    absPath: path.join(dir, filename),
    storagePath: path.posix.join('uploads', String(companyId), ownerType, String(ownerId), filename),
  };
}

async function moveFile(tempPath, destPath) {
  try {
    await ensureDir(path.dirname(destPath));
    await fs.rename(tempPath, destPath);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      // cross-device move fallback
      await ensureDir(path.dirname(destPath));
      await fs.copyFile(tempPath, destPath);
      await fs.unlink(tempPath);
      return;
    }
    throw err;
  }
}

function toFileDto(fileRow) {
  if (!fileRow) return null;
  const plain = fileRow.toJSON ? fileRow.toJSON() : fileRow;
  return {
    id: plain.id,
    ownerType: plain.ownerType,
    ownerId: plain.ownerId,
    purpose: plain.purpose,
    visibility: plain.visibility,
    publicKey: plain.publicKey,
    filename: plain.filename,
    mime: plain.mime,
    size: plain.size,
    url:
      plain.visibility === 'public'
        ? `/api/public-files/${plain.publicKey}`
        : `/api/files/${plain.id}/download`,
    createdAt: plain.createdAt,
  };
}

module.exports.createFromUpload = async ({
  file,
  ownerType,
  ownerId,
  purpose = 'file',
  visibility = 'private',
  companyId,
  user,
}) => {
  if (!file) throw new ApplicationError('VALIDATION_ERROR: file is required', 400);
  const normalizedOwnerType = normalizeOwnerType(ownerType);
  if (!OWNER_TYPES.has(normalizedOwnerType)) {
    throw new ApplicationError('VALIDATION_ERROR: invalid ownerType', 400);
  }
  if (!PURPOSES.has(purpose)) throw new ApplicationError('VALIDATION_ERROR: invalid purpose', 400);
  if (!VISIBILITY.has(visibility)) throw new ApplicationError('VALIDATION_ERROR: invalid visibility', 400);

  if (file.size > MAX_SIZE_BYTES) {
    throw new ApplicationError('VALIDATION_ERROR: file too large', 413);
  }

  assertVisibilityAllowed(ownerType, purpose, visibility);
  assertMimeAllowed(purpose, file.mimetype);

  // ownership / membership validation
  await assertOwnerInCompany({
    ownerType: normalizedOwnerType,
    ownerId,
    companyId,
    userId: user.id,
  });

  if (!canUploadByPolicy({ user, ownerType: normalizedOwnerType, ownerId })) {
    throw new ApplicationError('Insufficient permissions', 403);
  }

  const fileId = crypto.randomUUID();
  const safeName = safeBaseName(file.originalname);
  const publicKey = visibility === 'public' ? makePublicKey() : null;

  const { absPath, storagePath } = buildStoragePath({
    companyId,
    ownerType: normalizedOwnerType,
    ownerId,
    fileId,
    safeName,
    visibility,
    publicKey,
  });

  // move file into final location
  await moveFile(file.path, absPath);

  const row = await File.create({
    id: fileId,
    companyId,
    ownerType: normalizedOwnerType,
    ownerId,
    purpose,
    visibility,
    publicKey,
    filename: file.originalname,
    safeName,
    mime: file.mimetype,
    size: file.size,
    storagePath,
    uploadedBy: user.id,
  });

  return toFileDto(row);
};

module.exports.list = async ({ companyId, user, ownerType, ownerId, purpose }) => {
  const normalizedOwnerType = ownerType ? normalizeOwnerType(ownerType) : null;
  if (normalizedOwnerType && !OWNER_TYPES.has(normalizedOwnerType)) {
    throw new ApplicationError('VALIDATION_ERROR: invalid ownerType', 400);
  }
  if (purpose && !PURPOSES.has(purpose)) {
    throw new ApplicationError('VALIDATION_ERROR: invalid purpose', 400);
  }
  if (normalizedOwnerType && ownerId) {
    await assertOwnerInCompany({
      ownerType: normalizedOwnerType,
      ownerId,
      companyId,
      userId: user.id,
    });
  }

  const where = { companyId };
  if (normalizedOwnerType) where.ownerType = normalizedOwnerType;
  if (ownerId) where.ownerId = ownerId;
  if (purpose) where.purpose = purpose;

  const rows = await File.findAll({ where, order: [['created_at', 'DESC']] });
  return rows.map(toFileDto);
};

module.exports.getPrivateForDownload = async ({ companyId, user, id }) => {
  const row = await File.findOne({ where: { id, companyId } });
  if (!row || row.deletedAt) throw new ApplicationError('File not found', 404);

  await assertOwnerInCompany({
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    companyId,
    userId: user.id,
  });

  return row;
};

module.exports.getPublicForDownload = async ({ publicKey }) => {
  if (!PUBLIC_ENABLED) {
    throw new ApplicationError('Public files disabled', 404);
  }
  const row = await File.findOne({ where: { publicKey, visibility: 'public' } });
  if (!row || row.deletedAt) throw new ApplicationError('File not found', 404);
  return row;
};

module.exports.remove = async ({ companyId, user, id }) => {
  const row = await File.findOne({ where: { id, companyId } });
  if (!row) throw new ApplicationError('File not found', 404);

  if (!canDeleteByPolicy({ user, file: row })) {
    throw new ApplicationError('Insufficient permissions', 403);
  }

  row.deletedAt = new Date();
  await row.save();
  return true;
};

module.exports._internals = {
  OWNER_TYPES,
  PURPOSES,
  VISIBILITY,
  PUBLIC_WHITELIST,
  IMAGE_MIME,
  CHAT_ATTACHMENT_MIME,
  FILE_MIME,
  TMP_ROOT,
  PRIVATE_ROOT,
  PUBLIC_ROOT,
  MAX_SIZE_BYTES,
};
