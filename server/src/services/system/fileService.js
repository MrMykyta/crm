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
  Document,
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
  IMAGE_MAX_SIZE_BYTES,
  DOCUMENT_MAX_SIZE_BYTES,
  MEDIA_ARCHIVE_MAX_SIZE_BYTES,
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
  'document',
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
  'image/svg+xml',
  'image/bmp',
  'image/x-ms-bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
]);

const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]);

const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
]);

const ARCHIVE_MIME = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
]);

const DOCUMENT_MIME = new Set([
  'text/plain',
  'text/csv',
  'application/csv',
  'text/tab-separated-values',
  'application/json',
  'text/json',
  'application/xml',
  'text/xml',
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf',
  'text/rtf',
]);

const OTHER_MIME = new Set([
  'application/octet-stream',
  'binary/octet-stream',
]);

const MEDIA_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'svg',
  'tif',
  'tiff',
  'heic',
  'heif',
  'mp4',
  'mov',
  'webm',
  'avi',
  'mkv',
  'mp3',
  'wav',
  'm4a',
  'ogg',
]);

const DOCUMENT_EXT = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'rtf',
  'odt',
  'ods',
  'ppt',
  'pptx',
  'xml',
  'json',
]);

const CHAT_ATTACHMENT_MIME = new Set([
  ...IMAGE_MIME,
  ...DOCUMENT_MIME,
  ...ARCHIVE_MIME,
  ...VIDEO_MIME,
  ...AUDIO_MIME,
]);

const FILE_MIME = new Set([
  ...IMAGE_MIME,
  ...DOCUMENT_MIME,
  ...ARCHIVE_MIME,
  ...VIDEO_MIME,
  ...AUDIO_MIME,
  ...OTHER_MIME,
]);

// resolveMaxSizeByMime: выполняет вспомогательную бизнес-логику сервиса.
function resolveMaxSizeByMime(mime = '') {
  if (IMAGE_MIME.has(mime)) {
    return { bytes: IMAGE_MAX_SIZE_BYTES, label: 'image', maxMb: Math.round(IMAGE_MAX_SIZE_BYTES / 1024 / 1024) };
  }
  if (VIDEO_MIME.has(mime) || ARCHIVE_MIME.has(mime) || AUDIO_MIME.has(mime) || OTHER_MIME.has(mime)) {
    return { bytes: MEDIA_ARCHIVE_MAX_SIZE_BYTES, label: 'media/archive', maxMb: Math.round(MEDIA_ARCHIVE_MAX_SIZE_BYTES / 1024 / 1024) };
  }
  if (DOCUMENT_MIME.has(mime)) {
    return { bytes: DOCUMENT_MAX_SIZE_BYTES, label: 'document', maxMb: Math.round(DOCUMENT_MAX_SIZE_BYTES / 1024 / 1024) };
  }
  return { bytes: MAX_SIZE_BYTES, label: 'file', maxMb: Math.round(MAX_SIZE_BYTES / 1024 / 1024) };
}

// ensureDir: выполняет вспомогательную бизнес-логику сервиса.
function ensureDir(dir) {
  return fs.mkdir(dir, { recursive: true });
}

// safeBaseName: выполняет вспомогательную бизнес-логику сервиса.
function safeBaseName(original = '') {
  const ext = path.extname(original).toLowerCase().slice(0, 10);
  const rnd = crypto.randomBytes(6).toString('hex');
  return `${Date.now()}-${rnd}${ext}`;
}

// extFromName: выполняет вспомогательную бизнес-логику сервиса.
function extFromName(name = '') {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : '';
}

// inferFileSection: выполняет вспомогательную бизнес-логику сервиса.
function inferFileSection({ purpose, mime, filename } = {}) {
  const normalizedPurpose = String(purpose || '').toLowerCase();
  if (normalizedPurpose === 'product_image' || normalizedPurpose === 'media') return 'media';
  if (normalizedPurpose === 'document') return 'documents';
  if (normalizedPurpose === 'other') return 'other';

  const normalizedMime = String(mime || '').toLowerCase();
  const ext = extFromName(filename);

  if (
    IMAGE_MIME.has(normalizedMime) ||
    VIDEO_MIME.has(normalizedMime) ||
    AUDIO_MIME.has(normalizedMime) ||
    MEDIA_EXT.has(ext)
  ) {
    return 'media';
  }

  if (DOCUMENT_MIME.has(normalizedMime) || DOCUMENT_EXT.has(ext)) {
    return 'documents';
  }

  return 'other';
}

// normalizePurposeForOwner: приводит значения к единому формату для сервиса.
function normalizePurposeForOwner({ ownerType, purpose, mime, filename } = {}) {
  const normalizedOwnerType = normalizeOwnerType(ownerType);
  const normalizedPurpose = String(purpose || 'file').trim().toLowerCase();

  if (normalizedOwnerType !== 'product') return normalizedPurpose;
  if (IMAGE_PURPOSES.has(normalizedPurpose) || normalizedPurpose === 'chat_attachment') {
    return normalizedPurpose;
  }

  const section = inferFileSection({
    purpose: normalizedPurpose,
    mime,
    filename,
  });

  if (section === 'documents') return 'document';
  if (section === 'media') {
    return String(mime || '').toLowerCase().startsWith('image/') ? 'product_image' : 'media';
  }
  return 'other';
}

// normalizeIncomingMime: приводит значения к единому формату для сервиса.
function normalizeIncomingMime(file) {
  const raw = String(file?.mimetype || '').toLowerCase();
  if (raw && raw !== 'application/octet-stream' && raw !== 'binary/octet-stream') {
    return raw;
  }

  const ext = extFromName(file?.originalname);
  const byExt = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    heic: 'image/heic',
    heif: 'image/heif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
    rtf: 'application/rtf',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    json: 'application/json',
    xml: 'application/xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    bin: 'application/octet-stream',
  };
  return byExt[ext] || raw;
}

// makePublicKey: выполняет вспомогательную бизнес-логику сервиса.
function makePublicKey() {
  return crypto.randomBytes(16).toString('hex');
}

// isSystemPrivileged: проверяет бизнес-условие и возвращает boolean.
function isSystemPrivileged(user) {
  const role = user?.role || null;
  return role === 'admin' || role === 'owner';
}

// isChatMessageOwnerType: проверяет бизнес-условие и возвращает boolean.
function isChatMessageOwnerType(ownerType) {
  return String(ownerType || '').toLowerCase() === 'chatmessage';
}

// normalizeOwnerType: приводит значения к единому формату для сервиса.
function normalizeOwnerType(ownerType) {
  const lower = String(ownerType || '').trim().toLowerCase();
  if (!lower) return '';
  return lower === 'chatmessage' ? 'chatMessage' : lower;
}

// isUuid: проверяет бизнес-условие и возвращает boolean.
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

// hasPermission: проверяет наличие данных и возвращает результат проверки.
function hasPermission(user, perm) {
  const allow = user?.permissions?.allow || [];
  const deny = user?.permissions?.deny || [];
  if (Array.isArray(deny) && deny.includes(perm)) return false;
  if (Array.isArray(allow) && allow.length) return allow.includes(perm);
  // если ACL не настроен — не блокируем доступ по умолчанию
  return true;
}

// canUploadByPolicy: проверяет, может ли пользователь загружать файл в указанный ownerType.
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

// canDeleteByPolicy: проверяет, может ли пользователь удалить файл.
function canDeleteByPolicy({ user, file }) {
  if (!user || !file) return false;
  if (isSystemPrivileged(user)) return true;
  if (file.visibility === 'public') return false;
  return String(file.uploadedBy) === String(user.id);
}

// assertVisibilityAllowed: выполняет вспомогательную бизнес-логику сервиса.
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

// assertMimeAllowed: выполняет вспомогательную бизнес-логику сервиса.
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
  if (purpose === 'other' || purpose === 'file') {
    return;
  }
  if (!FILE_MIME.has(mime)) {
    throw new ApplicationError('VALIDATION_ERROR: file mime not allowed', 415);
  }
}

// assertOwnerInCompany: выполняет вспомогательную бизнес-логику сервиса.
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
  if (ownerType === 'document') return assertByModel(Document, 'Document');
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

// buildStoragePath: собирает служебную структуру для выполнения запроса.
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

// moveFile: выполняет вспомогательную бизнес-логику сервиса.
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

// toFileDto: выполняет вспомогательную бизнес-логику сервиса.
function toFileDto(fileRow) {
  if (!fileRow) return null;
  const plain = fileRow.toJSON ? fileRow.toJSON() : fileRow;
  const section = inferFileSection({
    purpose: plain.purpose,
    mime: plain.mime,
    filename: plain.filename || plain.safeName,
  });
  return {
    id: plain.id,
    ownerType: plain.ownerType,
    ownerId: plain.ownerId,
    purpose: plain.purpose,
    section,
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

// createFromUpload: создаёт новую запись и возвращает результат.
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
  if (!VISIBILITY.has(visibility)) throw new ApplicationError('VALIDATION_ERROR: invalid visibility', 400);

  const normalizedMime = normalizeIncomingMime(file);
  const normalizedPurpose = normalizePurposeForOwner({
    ownerType: normalizedOwnerType,
    purpose,
    mime: normalizedMime,
    filename: file.originalname,
  });
  if (!PURPOSES.has(normalizedPurpose)) throw new ApplicationError('VALIDATION_ERROR: invalid purpose', 400);

  const maxSize = resolveMaxSizeByMime(normalizedMime);
  if (file.size > maxSize.bytes) {
    throw new ApplicationError(
      `VALIDATION_ERROR: file too large for ${maxSize.label} (max ${maxSize.maxMb} MB)`,
      413
    );
  }

  assertVisibilityAllowed(normalizedOwnerType, normalizedPurpose, visibility);
  assertMimeAllowed(normalizedPurpose, normalizedMime);

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
    purpose: normalizedPurpose,
    visibility,
    publicKey,
    filename: file.originalname,
    safeName,
    mime: normalizedMime || file.mimetype,
    size: file.size,
    storagePath,
    uploadedBy: user.id,
  });

  return toFileDto(row);
};

module.exports.createFromBuffer = async ({
  buffer,
  filename,
  mime = 'application/pdf',
  ownerType,
  ownerId,
  purpose = 'document',
  visibility = 'private',
  companyId,
  user,
  enforcePolicy = false,
}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0) {
    throw new ApplicationError('VALIDATION_ERROR: buffer is required', 400);
  }

  const normalizedOwnerType = normalizeOwnerType(ownerType);
  if (!OWNER_TYPES.has(normalizedOwnerType)) {
    throw new ApplicationError('VALIDATION_ERROR: invalid ownerType', 400);
  }
  if (!VISIBILITY.has(visibility)) throw new ApplicationError('VALIDATION_ERROR: invalid visibility', 400);

  const normalizedMime = String(mime || '').trim().toLowerCase() || 'application/pdf';
  const normalizedPurpose = normalizePurposeForOwner({
    ownerType: normalizedOwnerType,
    purpose,
    mime: normalizedMime,
    filename,
  });
  if (!PURPOSES.has(normalizedPurpose)) throw new ApplicationError('VALIDATION_ERROR: invalid purpose', 400);

  const maxSize = resolveMaxSizeByMime(normalizedMime);
  if (buffer.length > maxSize.bytes) {
    throw new ApplicationError(
      `VALIDATION_ERROR: file too large for ${maxSize.label} (max ${maxSize.maxMb} MB)`,
      413
    );
  }

  assertVisibilityAllowed(normalizedOwnerType, normalizedPurpose, visibility);
  assertMimeAllowed(normalizedPurpose, normalizedMime);

  await assertOwnerInCompany({
    ownerType: normalizedOwnerType,
    ownerId,
    companyId,
    userId: user.id,
  });

  if (enforcePolicy && !canUploadByPolicy({ user, ownerType: normalizedOwnerType, ownerId })) {
    throw new ApplicationError('Insufficient permissions', 403);
  }

  const fileId = crypto.randomUUID();
  const safeName = safeBaseName(filename || 'document.pdf');
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

  await ensureDir(path.dirname(absPath));
  await fs.writeFile(absPath, buffer);

  const row = await File.create({
    id: fileId,
    companyId,
    ownerType: normalizedOwnerType,
    ownerId,
    purpose: normalizedPurpose,
    visibility,
    publicKey,
    filename: filename || safeName,
    safeName,
    mime: normalizedMime,
    size: buffer.length,
    storagePath,
    uploadedBy: user.id,
  });

  return toFileDto(row);
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
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

// getPrivateForDownload: возвращает данные по входным параметрам сервиса.
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

// getPublicForDownload: возвращает данные по входным параметрам сервиса.
module.exports.getPublicForDownload = async ({ publicKey }) => {
  if (!PUBLIC_ENABLED) {
    throw new ApplicationError('Public files disabled', 404);
  }
  const row = await File.findOne({ where: { publicKey, visibility: 'public' } });
  if (!row || row.deletedAt) throw new ApplicationError('File not found', 404);
  return row;
};

// remove: удаляет запись с учётом бизнес-ограничений.
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
  DOCUMENT_MIME,
  ARCHIVE_MIME,
  VIDEO_MIME,
  AUDIO_MIME,
  OTHER_MIME,
  inferFileSection,
  normalizePurposeForOwner,
  IMAGE_MAX_SIZE_BYTES,
  DOCUMENT_MAX_SIZE_BYTES,
  MEDIA_ARCHIVE_MAX_SIZE_BYTES,
  TMP_ROOT,
  PRIVATE_ROOT,
  PUBLIC_ROOT,
  MAX_SIZE_BYTES,
};
