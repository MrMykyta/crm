'use strict';

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const AppError = require('../../errors/AppError');
const {
  CreditNote,
  Document,
  File,
  Invoice,
  SharedDocument,
  SystemEvent,
} = require('../../models');
const { STORAGE_ROOT } = require('../../config/files');
const { buildPublicUrl } = require('../../config/publicUrl');
const generatedDocumentService = require('./generatedDocument.service');
const offerService = require('../oms/offerService');
const invoiceService = require('../oms/invoiceService');
const creditNoteService = require('../oms/creditNoteService');
const {
  buildCreditNoteDocumentDto,
  buildInvoiceDocumentDto,
  buildOfferDocumentDto,
} = require('./render/customerDocumentAdapter');

const DEFAULT_EXPIRATION_DAYS = 30;

const ENTITY_CONFIG = Object.freeze({
  offer: {
    documentType: 'OFFER',
    ownerPermission: 'offer:update',
    load: async ({ id, user, locale }) => {
      const offer = await offerService.getOfferById(id, user);
      return {
        entity: offer,
        dto: buildOfferDocumentDto({ offer, locale }),
      };
    },
  },
  invoice: {
    documentType: 'INVOICE',
    ownerPermission: 'order:update',
    load: async ({ id, user, locale }) => {
      const invoice = await invoiceService.get(id, user);
      if (!invoice) throw new AppError(404, 'Invoice not found', { code: 'NOT_FOUND' });
      return {
        entity: invoice,
        dto: buildInvoiceDocumentDto({ invoice, locale }),
      };
    },
  },
  credit_note: {
    documentType: 'CREDIT_NOTE',
    ownerPermission: 'order:update',
    load: async ({ id, user, locale }) => {
      const creditNote = await creditNoteService.getById({ companyId: user.companyId, id });
      const invoiceId = creditNote?.invoiceId || creditNote?.sourceInvoice?.id || null;
      const invoice = invoiceId ? await invoiceService.get(invoiceId, user) : null;
      return {
        entity: creditNote,
        dto: buildCreditNoteDocumentDto({ creditNote, invoice, locale }),
      };
    },
  },
});

function normalizeEntityType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'creditnote' || text === 'credit-note') return 'credit_note';
  return text;
}

function normalizeLocale(value) {
  const text = String(value || '').trim().toLowerCase();
  return ['en', 'ru', 'pl', 'ua'].includes(text) ? text : 'pl';
}

function getUserPermissions(user = {}) {
  const raw = user.permissions || user.permissionKeys || user.acl || [];
  if (Array.isArray(raw)) return new Set(raw.map(String));
  if (raw?.allow && Array.isArray(raw.allow)) return new Set(raw.allow.map(String));
  if (raw && typeof raw === 'object') return new Set(Object.keys(raw).filter((key) => raw[key]).map(String));
  return new Set();
}

function hasPermission(user, permission) {
  if (!permission) return true;
  if (user?.isSystem || user?.isOwner || user?.role === 'owner' || user?.role === 'admin') return true;
  const permissions = getUserPermissions(user);
  return permissions.has(permission) || permissions.has('*');
}

function defaultExpiresAt() {
  return new Date(Date.now() + DEFAULT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
}

function parseExpiresAt(value) {
  if (!value) return defaultExpiresAt();
  const date = new Date(value);
  if (Number.isNaN(+date)) {
    throw new AppError(400, 'expiresAt is invalid', { code: 'VALIDATION_ERROR' });
  }
  if (date <= new Date()) {
    throw new AppError(400, 'expiresAt must be in the future', { code: 'VALIDATION_ERROR' });
  }
  return date;
}

function sanitizeValue(value, key = '') {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (!value || typeof value !== 'object') return value;

  const out = {};
  Object.entries(value).forEach(([childKey, childValue]) => {
    const normalizedKey = childKey.toLowerCase();
    if (
      normalizedKey === 'id' ||
      normalizedKey.endsWith('id') ||
      normalizedKey.includes('internal') ||
      normalizedKey.includes('owner') ||
      normalizedKey.includes('cost') ||
      normalizedKey.includes('margin') ||
      normalizedKey === 'createdby' ||
      normalizedKey === 'updatedby' ||
      normalizedKey === 'deletedat' ||
      normalizedKey === 'accessmeta'
    ) {
      return;
    }
    out[childKey] = sanitizeValue(childValue, childKey);
  });

  if (key === 'entity' && value?.number && !out.number) {
    out.number = value.number;
  }
  return out;
}

function sanitizeRenderDto(dto = {}) {
  const sanitized = sanitizeValue(dto);
  sanitized.accessMeta = {
    public: true,
  };
  return sanitized;
}

async function loadEntityRenderDto({ entityType, entityId, user, locale }) {
  const config = ENTITY_CONFIG[entityType];
  if (!config) throw new AppError(400, 'Unsupported shared document entity type', { code: 'VALIDATION_ERROR' });
  if (!hasPermission(user, config.ownerPermission)) throw new AppError(403, 'Insufficient permissions');
  return config.load({ id: entityId, user, locale });
}

async function ensureGeneratedDocument({ entityType, entityId, user, locale, templateId }) {
  const existing = await Document.findOne({
    where: {
      companyId: user.companyId,
      sourceEntityType: entityType,
      sourceEntityId: entityId,
      fileId: { [Op.ne]: null },
    },
    order: [
      ['generatedAt', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });
  if (existing) return existing.get({ plain: true });

  const generated = await generatedDocumentService.generateForEntity({
    entityType,
    entityId,
    user,
    locale,
    templateId,
  });
  return generated.document;
}

function publicUrl(token) {
  return buildPublicUrl(`/public/doc/${encodeURIComponent(token)}`);
}

function publicDownloadUrl(token) {
  return `/api/public-documents/${encodeURIComponent(token)}/download`;
}

function toShareDto(row) {
  const share = row?.get ? row.get({ plain: true }) : row;
  if (!share) return null;
  return {
    id: share.id,
    entityType: share.sourceEntityType,
    entityId: share.sourceEntityId,
    documentId: share.documentId,
    fileId: share.fileId,
    token: share.token,
    url: publicUrl(share.token),
    downloadUrl: publicDownloadUrl(share.token),
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt,
    viewCount: share.viewCount || 0,
    downloadCount: share.downloadCount || 0,
    generatedAt: share.generatedAt,
    generatedBy: share.generatedBy,
    templateVersionId: share.templateVersionId,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
  };
}

async function createShare({ entityType, entityId, user, locale = 'pl', expiresAt, templateId = null } = {}) {
  const normalizedEntityType = normalizeEntityType(entityType);
  if (!user?.companyId) throw new AppError(403, 'Company context required');
  if (!entityId) throw new AppError(400, 'entityId is required', { code: 'VALIDATION_ERROR' });

  const normalizedLocale = normalizeLocale(locale);
  const loaded = await loadEntityRenderDto({
    entityType: normalizedEntityType,
    entityId,
    user,
    locale: normalizedLocale,
  });
  const document = await ensureGeneratedDocument({
    entityType: normalizedEntityType,
    entityId,
    user,
    locale: normalizedLocale,
    templateId,
  });

  if (!document?.fileId) {
    throw new AppError(409, 'Generated document has no PDF file', { code: 'DOCUMENT_FILE_MISSING' });
  }

  const share = await SharedDocument.create({
    companyId: user.companyId,
    documentId: document.id,
    fileId: document.fileId,
    sourceEntityType: normalizedEntityType,
    sourceEntityId: entityId,
    expiresAt: parseExpiresAt(expiresAt),
    generatedAt: new Date(),
    generatedBy: user.id || null,
    templateVersionId: document.templateVersionId || null,
    renderDtoSnapshot: sanitizeRenderDto(loaded.dto),
  });

  await logShareEvent({
    companyId: user.companyId,
    type: 'shared_document.generated',
    share,
    payload: { userId: user.id || null },
  });

  return toShareDto(share);
}

async function listShares({ entityType, entityId, user } = {}) {
  const normalizedEntityType = normalizeEntityType(entityType);
  if (!user?.companyId) throw new AppError(403, 'Company context required');
  const config = ENTITY_CONFIG[normalizedEntityType];
  if (!config) throw new AppError(400, 'Unsupported shared document entity type', { code: 'VALIDATION_ERROR' });
  if (!hasPermission(user, config.ownerPermission)) throw new AppError(403, 'Insufficient permissions');

  const rows = await SharedDocument.findAll({
    where: {
      companyId: user.companyId,
      sourceEntityType: normalizedEntityType,
      sourceEntityId: entityId,
    },
    order: [['createdAt', 'DESC']],
    limit: 20,
  });
  return rows.map(toShareDto);
}

async function revokeShare({ id, user } = {}) {
  if (!user?.companyId) throw new AppError(403, 'Company context required');
  const share = await SharedDocument.findOne({ where: { id, companyId: user.companyId } });
  if (!share) throw new AppError(404, 'Shared document not found', { code: 'NOT_FOUND' });
  const config = ENTITY_CONFIG[share.sourceEntityType];
  if (!hasPermission(user, config?.ownerPermission)) throw new AppError(403, 'Insufficient permissions');
  if (!share.revokedAt) {
    await share.update({ revokedAt: new Date() });
    await logShareEvent({
      companyId: user.companyId,
      type: 'shared_document.revoked',
      share,
      payload: { userId: user.id || null },
    });
  }
  return toShareDto(share);
}

function assertPublicShareUsable(share) {
  if (!share) throw new AppError(404, 'Shared document not found', { code: 'NOT_FOUND' });
  if (share.revokedAt) throw new AppError(410, 'Shared document revoked', { code: 'SHARE_REVOKED' });
  if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
    throw new AppError(410, 'Shared document expired', { code: 'SHARE_EXPIRED' });
  }
}

async function findByToken(token) {
  const normalized = String(token || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new AppError(404, 'Shared document not found', { code: 'NOT_FOUND' });
  }
  const share = await SharedDocument.findOne({ where: { token: normalized } });
  assertPublicShareUsable(share);
  return share;
}

function requestMeta(req) {
  return {
    ip: req.ip || req.headers?.['x-forwarded-for'] || null,
    userAgent: req.headers?.['user-agent'] || null,
  };
}

async function trackShareEvent({ share, type, req }) {
  await logShareEvent({
    companyId: share.companyId,
    type,
    share,
    payload: requestMeta(req),
  });
}

async function getPublicDocument({ token, req } = {}) {
  const share = await findByToken(token);
  await share.increment('viewCount');
  await trackShareEvent({ share, type: 'shared_document.viewed', req });
  await share.reload();
  return {
    document: share.renderDtoSnapshot,
    meta: {
      token: share.token,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount,
      downloadCount: share.downloadCount,
      generatedAt: share.generatedAt,
      downloadUrl: publicDownloadUrl(share.token),
    },
  };
}

async function getPublicDownload({ token, req } = {}) {
  const share = await findByToken(token);
  const file = await File.findOne({
    where: {
      id: share.fileId,
      companyId: share.companyId,
    },
  });
  if (!file) throw new AppError(404, 'Shared document file not found', { code: 'NOT_FOUND' });
  const absPath = path.join(STORAGE_ROOT, file.storagePath);
  if (!fs.existsSync(absPath)) throw new AppError(404, 'Shared document file missing', { code: 'NOT_FOUND' });

  await share.increment('downloadCount');
  await trackShareEvent({ share, type: 'shared_document.downloaded', req });

  return {
    file,
    absPath,
  };
}

async function logShareEvent({ companyId, type, share, payload = {} }) {
  try {
    await SystemEvent.create({
      companyId,
      type,
      entityType: share.sourceEntityType,
      entityId: share.sourceEntityId,
      payload: {
        sharedDocumentId: share.id,
        documentId: share.documentId,
        fileId: share.fileId,
        token: share.token,
        ...payload,
      },
    });
  } catch (_error) {
    // Share tracking must not break document access.
  }
}

module.exports = {
  createShare,
  getPublicDocument,
  getPublicDownload,
  listShares,
  revokeShare,
};
