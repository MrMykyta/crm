'use strict';

const { Op } = require('sequelize');
const {
  Company,
  Document,
  DocumentNumberingSetting,
  Invoice,
  Receipt,
  Adjustment,
  Shipment,
  TransferOrder,
} = require('../../models');
const AppError = require('../../errors/AppError');
const {
  DEFAULT_RESET_POLICY,
  DOCUMENT_TYPES,
  RESET_POLICIES,
  buildDefaultSetting,
  getDocumentTypeMeta,
  normalizeDocumentType,
  normalizeResetPolicy,
} = require('./documentNumberingConfig');

const MAX_PATTERN_LENGTH = 180;
const TOKEN_REGEX = /\{([^{}]+)\}/g;
const DOCUMENT_BACKED_TYPES = new Set([
  'QUOTE',
  'ORDER',
  'INVOICE',
  'BILL',
  'RECEIPT',
  'CONTRACT',
  'INVOICE_CORRECTION',
  'PROFORMA',
  'ADVANCE_INVOICE',
  'ADVANCE_PROFORMA',
  'WDT_INVOICE',
  'COMMERCIAL_PROPOSAL',
]);

function asText(value) {
  return String(value ?? '').trim();
}

function asDate(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'issueDate is invalid');
  }
  return parsed;
}

function asNonNegativeInteger(value, fieldName) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || !Number.isInteger(normalized) || normalized < 0) {
    throw new AppError(400, `${fieldName} must be a non-negative integer`);
  }
  return normalized;
}

function ensureCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required');
  }
}

function ensureDocumentType(documentType) {
  const normalizedType = normalizeDocumentType(documentType);
  if (!DOCUMENT_TYPES.includes(normalizedType)) {
    throw new AppError(400, 'documentType is invalid');
  }
  return normalizedType;
}

function normalizeResetPolicySafe(value) {
  const normalized = normalizeResetPolicy(value || DEFAULT_RESET_POLICY);
  if (!RESET_POLICIES.includes(normalized)) {
    throw new AppError(400, 'resetPolicy is invalid');
  }
  return normalized;
}

function parseToken(tokenRaw, fieldName = 'pattern') {
  const token = asText(tokenRaw).toUpperCase();
  if (!token) {
    throw new AppError(400, `${fieldName} contains an empty token`);
  }

  if (token === 'YYYY') return { kind: 'token', name: 'YYYY' };
  if (token === 'YY') return { kind: 'token', name: 'YY' };
  if (token === 'MM') return { kind: 'token', name: 'MM' };
  if (token === 'DD') return { kind: 'token', name: 'DD' };
  if (token === 'TYPE') return { kind: 'token', name: 'TYPE' };
  if (token === 'COMPANY') return { kind: 'token', name: 'COMPANY' };
  if (token === 'BRANCH') return { kind: 'token', name: 'BRANCH' };
  if (token === 'SEQ') return { kind: 'token', name: 'SEQ', padding: 0 };

  const seqMatch = /^SEQ:(\d{1,2})$/.exec(token);
  if (seqMatch) {
    const padding = Number(seqMatch[1]);
    if (padding < 1 || padding > 12) {
      throw new AppError(400, `${fieldName} token ${token} has invalid padding`);
    }
    return { kind: 'token', name: 'SEQ', padding };
  }

  throw new AppError(400, `${fieldName} contains unsupported token ${token}`);
}

function parsePattern(pattern, fieldName = 'pattern') {
  const normalized = asText(pattern);
  if (!normalized) {
    throw new AppError(400, `${fieldName} is required`);
  }

  if (normalized.length > MAX_PATTERN_LENGTH) {
    throw new AppError(400, `${fieldName} must be <= ${MAX_PATTERN_LENGTH} chars`);
  }

  const segments = [];
  let cursor = 0;
  let hasSeq = false;

  TOKEN_REGEX.lastIndex = 0;
  let match;
  while ((match = TOKEN_REGEX.exec(normalized)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: 'text', value: normalized.slice(cursor, match.index) });
    }

    const parsedToken = parseToken(match[1], fieldName);
    if (parsedToken.name === 'SEQ') {
      if (hasSeq) {
        throw new AppError(400, `${fieldName} must contain only one SEQ token`);
      }
      hasSeq = true;
    }
    segments.push(parsedToken);
    cursor = match.index + match[0].length;
  }

  if (cursor < normalized.length) {
    segments.push({ kind: 'text', value: normalized.slice(cursor) });
  }

  const hasDanglingBraces = segments.some(
    (segment) => segment.kind === 'text' && (segment.value.includes('{') || segment.value.includes('}'))
  );
  if (hasDanglingBraces) {
    throw new AppError(400, `${fieldName} contains invalid token syntax`);
  }

  if (!hasSeq) {
    throw new AppError(400, `${fieldName} must include {SEQ} token`);
  }

  return {
    pattern: normalized,
    segments,
  };
}

function padSequence(sequence, padding = 0) {
  const safeSequence = asNonNegativeInteger(sequence, 'sequence');
  if (!padding) return String(safeSequence);
  return String(safeSequence).padStart(padding, '0');
}

function sanitizeToken(value, fallback = '') {
  const normalized = asText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return normalized || fallback;
}

function resolvePatternToken(token, context) {
  const issueDate = context.issueDate;
  switch (token.name) {
    case 'YYYY':
      return String(issueDate.getUTCFullYear());
    case 'YY':
      return String(issueDate.getUTCFullYear()).slice(-2);
    case 'MM':
      return String(issueDate.getUTCMonth() + 1).padStart(2, '0');
    case 'DD':
      return String(issueDate.getUTCDate()).padStart(2, '0');
    case 'SEQ':
      return padSequence(context.sequence, token.padding);
    case 'TYPE':
      return context.typeCode;
    case 'COMPANY':
      return context.companyCode;
    case 'BRANCH':
      return context.branchCode;
    default:
      return '';
  }
}

function renderPattern(parsedPattern, context) {
  return parsedPattern.segments
    .map((segment) => {
      if (segment.kind === 'text') return segment.value;
      return resolvePatternToken(segment, context);
    })
    .join('');
}

function periodToken(date, resetPolicy) {
  if (resetPolicy === 'none') return 'none';
  const year = String(date.getUTCFullYear());
  if (resetPolicy === 'yearly') return year;
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function calculateNextSequence({
  sequenceCounter,
  resetPolicy,
  lastResetToken,
  lastGeneratedAt,
  issueDate,
}) {
  const normalizedResetPolicy = normalizeResetPolicySafe(resetPolicy);
  const baseCounter = asNonNegativeInteger(sequenceCounter || 0, 'sequenceCounter');
  const targetDate = asDate(issueDate);
  const currentPeriodToken = periodToken(targetDate, normalizedResetPolicy);
  const inferredResetToken =
    asText(lastResetToken) ||
    (lastGeneratedAt ? periodToken(asDate(lastGeneratedAt), normalizedResetPolicy) : currentPeriodToken);

  const shouldReset = normalizedResetPolicy !== 'none' && inferredResetToken !== currentPeriodToken;
  const nextSequence = shouldReset ? 1 : baseCounter + 1;

  return {
    nextSequence,
    currentPeriodToken,
  };
}

function legacyPatternFromPayload(payload = {}, documentType) {
  const prefix = asText(payload.prefix) || getDocumentTypeMeta(documentType)?.typeCode || 'DOC';
  const formatPreset = asText(payload.formatPreset) || 'PREFIX-YYYY-NNNN';
  if (formatPreset === 'PREFIX-YYYY-MM-NNNN') {
    return `${prefix}/{YYYY}/{MM}/{SEQ:4}`;
  }
  return `${prefix}/{YYYY}/{SEQ:4}`;
}

function buildLegacyMirrorFields({ documentType, pattern, enabled, resetPolicy, sequenceCounter }) {
  const typeCode = getDocumentTypeMeta(documentType)?.typeCode || 'DOC';
  const hasMonth = pattern.includes('{MM}');
  return {
    prefix: typeCode,
    formatPreset: hasMonth ? 'PREFIX-YYYY-MM-NNNN' : 'PREFIX-YYYY-NNNN',
    resetPeriod: resetPolicy === 'none' ? 'never' : resetPolicy,
    startNumber: 1,
    currentNumber: sequenceCounter,
    isAutoEnabled: enabled,
  };
}

async function getCompanyTokens({ companyId, transaction }) {
  const company = await Company.findByPk(companyId, {
    attributes: ['id', 'name'],
    transaction,
  });
  const companyCode = sanitizeToken(company?.name, sanitizeToken(String(companyId).slice(0, 8), 'COMPANY'));
  return {
    companyCode,
    branchCode: '',
  };
}

function normalizeSettingRow(row, { issueDate = new Date(), companyTokens = null } = {}) {
  const documentType = ensureDocumentType(row?.documentType);
  const defaults = buildDefaultSetting(documentType);
  const meta = getDocumentTypeMeta(documentType) || {};

  const enabled = typeof row?.enabled === 'boolean' ? row.enabled : Boolean(row?.isAutoEnabled ?? defaults.enabled);
  const patternRaw = asText(row?.pattern) || defaults.pattern;
  let parsedPattern;
  let pattern = patternRaw;

  try {
    parsedPattern = parsePattern(patternRaw);
  } catch (_e) {
    pattern = defaults.pattern;
    parsedPattern = parsePattern(pattern);
  }

  const resetPolicy = normalizeResetPolicySafe(row?.resetPolicy || row?.resetPeriod || defaults.resetPolicy);
  const sequenceCounter = asNonNegativeInteger(
    row?.sequenceCounter ?? row?.currentNumber ?? defaults.sequenceCounter,
    `sequenceCounter (${documentType})`
  );
  const lastNumber = row?.lastNumber || null;
  const typeCode = sanitizeToken(meta.typeCode || defaults.typeCode || documentType, documentType);
  const issueDateSafe = asDate(issueDate);
  const resolvedTokens = companyTokens || { companyCode: '', branchCode: '' };

  const nextInfo = calculateNextSequence({
    sequenceCounter,
    resetPolicy,
    lastResetToken: row?.lastResetToken,
    lastGeneratedAt: row?.lastGeneratedAt,
    issueDate: issueDateSafe,
  });
  const nextSequence = Number(nextInfo.nextSequence || 1);
  const lastSequence = Math.max(nextSequence - 1, 0);

  const nextNumberPreview = renderPattern(parsedPattern, {
    issueDate: issueDateSafe,
    sequence: nextSequence,
    typeCode,
    companyCode: resolvedTokens.companyCode,
    branchCode: resolvedTokens.branchCode,
  });
  const lastNumberPreview = lastSequence > 0
    ? renderPattern(parsedPattern, {
      issueDate: issueDateSafe,
      sequence: lastSequence,
      typeCode,
      companyCode: resolvedTokens.companyCode,
      branchCode: resolvedTokens.branchCode,
    })
    : '0';

  return {
    id: row?.id || null,
    documentType,
    label: meta.label || defaults.label || documentType,
    category: meta.category || defaults.category || 'sales',
    typeCode,
    enabled,
    pattern,
    sequenceCounter,
    lastNumber,
    lastSequence,
    lastNumberPreview,
    resetPolicy,
    nextSequence,
    nextNumberPreview,
    lastGeneratedAt: row?.lastGeneratedAt || null,
    lastResetToken: row?.lastResetToken || '',
  };
}

async function getOrCreateSettingRow({ companyId, documentType, transaction, lock = true }) {
  let row = await DocumentNumberingSetting.findOne({
    where: { companyId, documentType },
    transaction,
    lock: transaction && lock ? transaction.LOCK.UPDATE : undefined,
  });
  if (row) return row;

  const defaults = buildDefaultSetting(documentType);
  const legacyFields = buildLegacyMirrorFields({
    documentType,
    pattern: defaults.pattern,
    enabled: defaults.enabled,
    resetPolicy: defaults.resetPolicy,
    sequenceCounter: defaults.sequenceCounter,
  });

  try {
    await DocumentNumberingSetting.create(
      {
        companyId,
        documentType,
        enabled: defaults.enabled,
        pattern: defaults.pattern,
        sequenceCounter: defaults.sequenceCounter,
        lastNumber: defaults.lastNumber,
        resetPolicy: defaults.resetPolicy,
        lastGeneratedAt: null,
        lastResetToken: '',
        ...legacyFields,
      },
      { transaction }
    );
  } catch (error) {
    if (error?.name !== 'SequelizeUniqueConstraintError') {
      throw error;
    }
  }

  row = await DocumentNumberingSetting.findOne({
    where: { companyId, documentType },
    transaction,
    lock: transaction && lock ? transaction.LOCK.UPDATE : undefined,
  });

  if (!row) {
    throw new AppError(500, `Unable to initialize numbering settings for ${documentType}`);
  }

  return row;
}

function normalizeBatchPayload(payload = {}) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  throw new AppError(400, 'items must be an array');
}

function normalizeUpdatePatch(payload = {}, { documentType, existingRow }) {
  const normalizedType = ensureDocumentType(documentType);
  const existing = normalizeSettingRow(existingRow);

  const hasEnabled = Object.prototype.hasOwnProperty.call(payload, 'enabled')
    || Object.prototype.hasOwnProperty.call(payload, 'isAutoEnabled');
  const enabledRaw = Object.prototype.hasOwnProperty.call(payload, 'enabled')
    ? payload.enabled
    : payload.isAutoEnabled;
  const enabled = hasEnabled ? Boolean(enabledRaw) : existing.enabled;

  const hasPattern = Object.prototype.hasOwnProperty.call(payload, 'pattern');
  const hasLegacyPatternFields =
    Object.prototype.hasOwnProperty.call(payload, 'prefix')
    || Object.prototype.hasOwnProperty.call(payload, 'formatPreset');
  const patternCandidate = hasPattern
    ? payload.pattern
    : hasLegacyPatternFields
      ? legacyPatternFromPayload(payload, normalizedType)
      : existing.pattern;
  const parsedPattern = parsePattern(patternCandidate);
  const pattern = parsedPattern.pattern;

  const hasResetPolicy = Object.prototype.hasOwnProperty.call(payload, 'resetPolicy')
    || Object.prototype.hasOwnProperty.call(payload, 'resetPeriod');
  const resetPolicyRaw = Object.prototype.hasOwnProperty.call(payload, 'resetPolicy')
    ? payload.resetPolicy
    : payload.resetPeriod;
  const resetPolicy = hasResetPolicy
    ? normalizeResetPolicySafe(resetPolicyRaw)
    : normalizeResetPolicySafe(existing.resetPolicy);

  const hasSequenceCounter = Object.prototype.hasOwnProperty.call(payload, 'sequenceCounter')
    || Object.prototype.hasOwnProperty.call(payload, 'currentNumber');
  const sequenceCounterRaw = Object.prototype.hasOwnProperty.call(payload, 'sequenceCounter')
    ? payload.sequenceCounter
    : payload.currentNumber;
  const sequenceCounter = hasSequenceCounter
    ? asNonNegativeInteger(sequenceCounterRaw, `sequenceCounter (${normalizedType})`)
    : existing.sequenceCounter;

  const legacyFields = buildLegacyMirrorFields({
    documentType: normalizedType,
    pattern,
    enabled,
    resetPolicy,
    sequenceCounter,
  });

  return {
    enabled,
    pattern,
    resetPolicy,
    sequenceCounter,
    ...legacyFields,
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSequenceRegex(parsedPattern) {
  let hasSequence = false;
  let regexSource = '^';

  parsedPattern.segments.forEach((segment) => {
    if (segment.kind === 'text') {
      regexSource += escapeRegex(segment.value);
      return;
    }

    switch (segment.name) {
      case 'YYYY':
        regexSource += '\\d{4}';
        break;
      case 'YY':
        regexSource += '\\d{2}';
        break;
      case 'MM':
      case 'DD':
        regexSource += '\\d{2}';
        break;
      case 'SEQ':
        hasSequence = true;
        regexSource += segment.padding ? `(\\d{1,${segment.padding}})` : '(\\d+)';
        break;
      default:
        regexSource += '.+?';
        break;
    }
  });

  regexSource += '$';
  return hasSequence ? new RegExp(regexSource, 'i') : null;
}

function extractSequenceFromNumber(numberValue, parsedPattern) {
  const number = asText(numberValue);
  if (!number) return null;

  const regex = buildSequenceRegex(parsedPattern);
  if (regex) {
    const matched = regex.exec(number);
    if (matched && matched[1]) {
      const parsed = Number(matched[1]);
      if (Number.isInteger(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }

  const fallback = /(\d+)(?!.*\d)/.exec(number);
  if (!fallback) return null;
  const parsed = Number(fallback[1]);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

async function collectHistoricalNumbers({ companyId, documentType, transaction }) {
  const normalizedType = ensureDocumentType(documentType);
  const result = [];

  if (DOCUMENT_BACKED_TYPES.has(normalizedType)) {
    const rows = await Document.findAll({
      where: {
        companyId,
        type: normalizedType,
        number: { [Op.ne]: null },
      },
      attributes: ['number', 'issueDate', 'createdAt'],
      transaction,
    });
    rows.forEach((row) => {
      result.push({
        number: row.number,
        date: row.issueDate || row.createdAt || null,
      });
    });
  }

  if (normalizedType === 'INVOICE') {
    const rows = await Invoice.findAll({
      where: {
        companyId,
        number: { [Op.ne]: null },
      },
      attributes: ['number', 'issueDate', 'createdAt'],
      transaction,
    });
    rows.forEach((row) => {
      result.push({
        number: row.number,
        date: row.issueDate || row.createdAt || null,
      });
    });
  }

  if (normalizedType === 'PZ') {
    const rows = await Receipt.findAll({
      where: {
        companyId,
        number: { [Op.ne]: null },
      },
      attributes: ['number', 'createdAt'],
      transaction,
    });
    rows.forEach((row) => {
      result.push({
        number: row.number,
        date: row.createdAt || null,
      });
    });
  }

  if (normalizedType === 'MM') {
    const rows = await TransferOrder.findAll({
      where: {
        companyId,
        number: { [Op.ne]: null },
      },
      attributes: ['number', 'createdAt'],
      transaction,
    });
    rows.forEach((row) => {
      result.push({
        number: row.number,
        date: row.createdAt || null,
      });
    });
  }

  if (normalizedType === 'WZ') {
    const rows = await Shipment.findAll({
      where: {
        companyId,
        number: { [Op.ne]: null },
      },
      attributes: ['number', 'createdAt'],
      transaction,
    });
    rows.forEach((row) => {
      result.push({
        number: row.number,
        date: row.createdAt || null,
      });
    });
  }

  if (normalizedType === 'RW' || normalizedType === 'PW') {
    const rows = await Adjustment.findAll({
      where: {
        companyId,
        documentType: normalizedType,
        number: { [Op.ne]: null },
      },
      attributes: ['number', 'createdAt'],
      transaction,
    });
    rows.forEach((row) => {
      result.push({
        number: row.number,
        date: row.createdAt || null,
      });
    });
  }

  return result;
}

async function isNumberUsed({ companyId, documentType, number, transaction }) {
  const normalizedType = ensureDocumentType(documentType);
  const normalizedNumber = asText(number);
  if (!normalizedNumber) return false;

  if (DOCUMENT_BACKED_TYPES.has(normalizedType)) {
    const found = await Document.findOne({
      where: {
        companyId,
        type: normalizedType,
        number: normalizedNumber,
      },
      attributes: ['id'],
      transaction,
    });
    if (found) return true;
  }

  if (normalizedType === 'INVOICE') {
    const found = await Invoice.findOne({
      where: {
        companyId,
        number: normalizedNumber,
      },
      attributes: ['id'],
      transaction,
    });
    if (found) return true;
  }

  if (normalizedType === 'PZ') {
    const found = await Receipt.findOne({
      where: {
        companyId,
        number: normalizedNumber,
      },
      attributes: ['id'],
      transaction,
    });
    if (found) return true;
  }

  if (normalizedType === 'MM') {
    const found = await TransferOrder.findOne({
      where: {
        companyId,
        number: normalizedNumber,
      },
      attributes: ['id'],
      transaction,
    });
    if (found) return true;
  }

  if (normalizedType === 'WZ') {
    const found = await Shipment.findOne({
      where: {
        companyId,
        number: normalizedNumber,
      },
      attributes: ['id'],
      transaction,
    });
    if (found) return true;
  }

  if (normalizedType === 'RW' || normalizedType === 'PW') {
    const found = await Adjustment.findOne({
      where: {
        companyId,
        documentType: normalizedType,
        number: normalizedNumber,
      },
      attributes: ['id'],
      transaction,
    });
    if (found) return true;
  }

  return false;
}

async function listCompanyNumberingSettings({ companyId, issueDate = new Date(), transaction = null }) {
  ensureCompanyId(companyId);

  const rows = await DocumentNumberingSetting.findAll({
    where: { companyId },
    order: [['documentType', 'ASC']],
    transaction,
  });
  const byType = new Map(rows.map((row) => [row.documentType, row]));
  const companyTokens = await getCompanyTokens({ companyId, transaction });

  return DOCUMENT_TYPES.map((documentType) => {
    const row = byType.get(documentType);
    if (!row) {
      const defaults = buildDefaultSetting(documentType);
      return normalizeSettingRow(defaults, {
        issueDate,
        companyTokens,
      });
    }
    return normalizeSettingRow(row, {
      issueDate,
      companyTokens,
    });
  });
}

async function updateCompanyNumberingSetting({
  companyId,
  documentType,
  payload = {},
  transaction = null,
}) {
  ensureCompanyId(companyId);
  const normalizedType = ensureDocumentType(documentType);

  const ownTransaction = !transaction;
  const tx = transaction || (await DocumentNumberingSetting.sequelize.transaction());
  try {
    const row = await getOrCreateSettingRow({
      companyId,
      documentType: normalizedType,
      transaction: tx,
      lock: true,
    });

    const updates = normalizeUpdatePatch(payload, {
      documentType: normalizedType,
      existingRow: row,
    });

    await row.update(updates, { transaction: tx });
    if (ownTransaction) {
      await tx.commit();
    }
  } catch (error) {
    if (ownTransaction) {
      await tx.rollback();
    }
    throw error;
  }

  const companyTokens = await getCompanyTokens({ companyId, transaction: ownTransaction ? null : tx });
  const updated = await DocumentNumberingSetting.findOne({
    where: { companyId, documentType: normalizedType },
    transaction: ownTransaction ? null : tx,
  });
  return normalizeSettingRow(updated, {
    issueDate: payload?.issueDate || new Date(),
    companyTokens,
  });
}

async function updateCompanyNumberingSettings({ companyId, payload = {}, transaction = null }) {
  ensureCompanyId(companyId);
  const items = normalizeBatchPayload(payload);
  if (!items.length) {
    throw new AppError(400, 'items must not be empty');
  }

  const ownTransaction = !transaction;
  const tx = transaction || (await DocumentNumberingSetting.sequelize.transaction());
  try {
    const seen = new Set();
    for (const item of items) {
      const normalizedType = ensureDocumentType(item?.documentType);
      if (seen.has(normalizedType)) {
        throw new AppError(400, `Duplicate documentType: ${normalizedType}`);
      }
      seen.add(normalizedType);

      const row = await getOrCreateSettingRow({
        companyId,
        documentType: normalizedType,
        transaction: tx,
        lock: true,
      });
      const updates = normalizeUpdatePatch(item, {
        documentType: normalizedType,
        existingRow: row,
      });
      await row.update(updates, { transaction: tx });
    }
    if (ownTransaction) {
      await tx.commit();
    }
  } catch (error) {
    if (ownTransaction) {
      await tx.rollback();
    }
    throw error;
  }

  return listCompanyNumberingSettings({ companyId, transaction: ownTransaction ? null : tx });
}

async function previewNextDocumentNumber({
  companyId,
  documentType,
  pattern = null,
  issueDate = new Date(),
  transaction = null,
}) {
  ensureCompanyId(companyId);
  const normalizedType = ensureDocumentType(documentType);

  const row = await getOrCreateSettingRow({
    companyId,
    documentType: normalizedType,
    transaction,
    lock: Boolean(transaction),
  });
  const companyTokens = await getCompanyTokens({ companyId, transaction });
  const normalized = normalizeSettingRow(row, {
    issueDate,
    companyTokens,
  });

  const selectedPattern = pattern !== null && pattern !== undefined ? asText(pattern) : normalized.pattern;
  const parsedPattern = parsePattern(selectedPattern);
  const issueDateSafe = asDate(issueDate);
  const nextInfo = calculateNextSequence({
    sequenceCounter: normalized.sequenceCounter,
    resetPolicy: normalized.resetPolicy,
    lastResetToken: normalized.lastResetToken,
    lastGeneratedAt: normalized.lastGeneratedAt,
    issueDate: issueDateSafe,
  });

  const preview = renderPattern(parsedPattern, {
    issueDate: issueDateSafe,
    sequence: nextInfo.nextSequence,
    typeCode: normalized.typeCode,
    companyCode: companyTokens.companyCode,
    branchCode: companyTokens.branchCode,
  });

  return {
    documentType: normalizedType,
    pattern: parsedPattern.pattern,
    nextSequence: nextInfo.nextSequence,
    preview,
    enabled: normalized.enabled,
    resetPolicy: normalized.resetPolicy,
  };
}

async function bootstrapCompanyNumberingSettings({ companyId, transaction = null }) {
  ensureCompanyId(companyId);

  const ownTransaction = !transaction;
  const tx = transaction || (await DocumentNumberingSetting.sequelize.transaction());
  try {
    for (const documentType of DOCUMENT_TYPES) {
      await getOrCreateSettingRow({
        companyId,
        documentType,
        transaction: tx,
        lock: false,
      });
    }
    if (ownTransaction) {
      await tx.commit();
    }
  } catch (error) {
    if (ownTransaction) {
      await tx.rollback();
    }
    throw error;
  }

  return listCompanyNumberingSettings({ companyId, transaction: ownTransaction ? null : tx });
}

async function rebuildCompanyNumberingSettings({ companyId, payload = {} }) {
  ensureCompanyId(companyId);

  const requestedType = asText(payload?.documentType || payload?.type).toUpperCase();
  const targetTypes = requestedType ? [ensureDocumentType(requestedType)] : DOCUMENT_TYPES;

  const tx = await DocumentNumberingSetting.sequelize.transaction();
  try {
    for (const documentType of targetTypes) {
      const row = await getOrCreateSettingRow({
        companyId,
        documentType,
        transaction: tx,
        lock: true,
      });

      const normalized = normalizeSettingRow(row, { issueDate: new Date() });
      const parsedPattern = parsePattern(normalized.pattern);
      const history = await collectHistoricalNumbers({
        companyId,
        documentType,
        transaction: tx,
      });

      let maxSequence = 0;
      let latest = null;
      history.forEach((item) => {
        const sequence = extractSequenceFromNumber(item.number, parsedPattern);
        if (Number.isInteger(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
        const itemDate = item.date ? asDate(item.date) : null;
        if (!latest || (itemDate && latest.date && itemDate > latest.date) || (itemDate && !latest.date)) {
          latest = { number: item.number, date: itemDate };
        }
      });

      const resetPolicy = normalizeResetPolicySafe(normalized.resetPolicy);
      const lastResetToken = latest?.date ? periodToken(latest.date, resetPolicy) : periodToken(new Date(), resetPolicy);

      const updates = {
        sequenceCounter: Math.max(maxSequence, normalized.sequenceCounter),
        lastNumber: latest?.number || normalized.lastNumber || null,
        lastGeneratedAt: latest?.date || normalized.lastGeneratedAt || null,
        lastResetToken,
      };
      Object.assign(
        updates,
        buildLegacyMirrorFields({
          documentType,
          pattern: normalized.pattern,
          enabled: normalized.enabled,
          resetPolicy,
          sequenceCounter: updates.sequenceCounter,
        })
      );

      await row.update(updates, { transaction: tx });
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  const all = await listCompanyNumberingSettings({ companyId });
  if (!requestedType) return all;
  return all.filter((item) => item.documentType === targetTypes[0]);
}

async function assertDocumentTypeEnabled({ companyId, documentType, transaction }) {
  ensureCompanyId(companyId);
  const normalizedType = ensureDocumentType(documentType);
  const row = await getOrCreateSettingRow({
    companyId,
    documentType: normalizedType,
    transaction,
    lock: Boolean(transaction),
  });
  const normalized = normalizeSettingRow(row);
  if (!normalized.enabled) {
    throw new AppError(409, `Document type ${normalizedType} is disabled in numbering settings`);
  }
  return normalized;
}

async function generateNextDocumentNumber({ companyId, documentType, issueDate, transaction }) {
  ensureCompanyId(companyId);
  if (!transaction) {
    throw new AppError(500, 'Transaction is required for number generation');
  }

  const normalizedType = ensureDocumentType(documentType);
  const row = await getOrCreateSettingRow({
    companyId,
    documentType: normalizedType,
    transaction,
    lock: true,
  });

  const companyTokens = await getCompanyTokens({ companyId, transaction });
  const normalized = normalizeSettingRow(row, {
    issueDate: issueDate || new Date(),
    companyTokens,
  });

  if (!normalized.enabled) {
    throw new AppError(409, `Document type ${normalizedType} is disabled in numbering settings`);
  }

  const parsedPattern = parsePattern(normalized.pattern);
  const issueDateSafe = asDate(issueDate || new Date());
  const nextInfo = calculateNextSequence({
    sequenceCounter: normalized.sequenceCounter,
    resetPolicy: normalized.resetPolicy,
    lastResetToken: normalized.lastResetToken,
    lastGeneratedAt: normalized.lastGeneratedAt,
    issueDate: issueDateSafe,
  });

  let generatedNumber = null;
  let generatedSequence = nextInfo.nextSequence;
  for (let offset = 0; offset < 200; offset += 1) {
    const candidateSequence = nextInfo.nextSequence + offset;
    const candidateNumber = renderPattern(parsedPattern, {
      issueDate: issueDateSafe,
      sequence: candidateSequence,
      typeCode: normalized.typeCode,
      companyCode: companyTokens.companyCode,
      branchCode: companyTokens.branchCode,
    });
    // eslint-disable-next-line no-await-in-loop
    const used = await isNumberUsed({
      companyId,
      documentType: normalizedType,
      number: candidateNumber,
      transaction,
    });
    if (!used) {
      generatedNumber = candidateNumber;
      generatedSequence = candidateSequence;
      break;
    }
  }

  if (!generatedNumber) {
    throw new AppError(409, `Unable to reserve number for ${normalizedType}`);
  }

  const updates = {
    sequenceCounter: generatedSequence,
    lastNumber: generatedNumber,
    lastGeneratedAt: new Date(),
    lastResetToken: nextInfo.currentPeriodToken,
  };
  Object.assign(
    updates,
    buildLegacyMirrorFields({
      documentType: normalizedType,
      pattern: normalized.pattern,
      enabled: normalized.enabled,
      resetPolicy: normalized.resetPolicy,
      sequenceCounter: generatedSequence,
    })
  );

  await row.update(updates, { transaction });
  return generatedNumber;
}

module.exports = {
  parsePattern,
  listCompanyNumberingSettings,
  updateCompanyNumberingSetting,
  updateCompanyNumberingSettings,
  previewNextDocumentNumber,
  bootstrapCompanyNumberingSettings,
  rebuildCompanyNumberingSettings,
  assertDocumentTypeEnabled,
  generateNextDocumentNumber,
};
