'use strict';

const AppError = require('../../errors/AppError');
const {
  CompanyInvoiceSetting,
  CompanyInvoiceTypeSetting,
  Document,
} = require('../../models');
const {
  listCompanyNumberingSettings,
  updateCompanyNumberingSetting,
} = require('./documentNumberingService');
const {
  uiPatternToBackendPattern,
  backendPatternToUiPattern,
  buildNumberPreview,
} = require('./numberPatternUiService');
const {
  INVOICE_DEFAULT_TYPE_KEYS,
  INVOICE_PAYMENT_METHODS,
  INVOICE_PAYMENT_TERM_DAYS,
  INVOICE_CURRENCIES,
  INVOICE_STOCK_UPDATE_MODES,
  INVOICE_ANNOTATION_MODES,
  DEFAULT_INVOICE_SETTINGS,
  INVOICE_TYPE_DEFINITIONS,
  getInvoiceTypeDefinition,
} = require('./invoiceSettingsConfig');

const MAX_TEMPLATE_HTML_LENGTH = 20000;
const FORBIDDEN_BLOCK_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'meta', 'link'];
const ALLOWED_HTML_TAGS = new Set(['p', 'div', 'span', 'strong', 'b', 'a', 'br']);
const TEXT_ALIGN_VALUES = new Set(['left', 'center']);
const SAFE_LINK_RE = /^(https?:|mailto:|tel:|\/|#|\.\.?\/)/i;

function asText(value) {
  return String(value ?? '').trim();
}

function asOptionalText(value) {
  const normalized = asText(value);
  return normalized || null;
}

function normalizeSequenceForResponse(sequenceRaw, fallback = 1) {
  const normalized = Number(sequenceRaw);
  if (!Number.isInteger(normalized) || normalized < 1) {
    return fallback;
  }
  return normalized;
}

function buildPreviewSafely({ pattern, sequence, fallback = '0' }) {
  try {
    return buildNumberPreview({
      pattern,
      sequence,
      issueDate: new Date(),
      fieldName: 'numberPattern',
    });
  } catch (_error) {
    return asOptionalText(fallback) || '0';
  }
}

function ensureCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
}

function normalizeInvoiceDefaultType(value, fallback = DEFAULT_INVOICE_SETTINGS.invoiceDefaultType) {
  const normalized = asText(value) || fallback;
  if (!INVOICE_DEFAULT_TYPE_KEYS.includes(normalized)) {
    throw new AppError(400, 'invoiceDefaultType is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: INVOICE_DEFAULT_TYPE_KEYS },
    });
  }
  return normalized;
}

function normalizePaymentMethod(value, fallback = DEFAULT_INVOICE_SETTINGS.invoiceDefaultPaymentMethod) {
  const normalized = asText(value) || fallback;
  if (!INVOICE_PAYMENT_METHODS.includes(normalized)) {
    throw new AppError(400, 'invoiceDefaultPaymentMethod is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: INVOICE_PAYMENT_METHODS },
    });
  }
  return normalized;
}

function normalizePaymentTermDays(value, fallback = DEFAULT_INVOICE_SETTINGS.invoiceDefaultPaymentTermDays) {
  const source = value === undefined || value === null || value === '' ? fallback : value;
  const normalized = Number(source);
  if (!Number.isInteger(normalized) || !INVOICE_PAYMENT_TERM_DAYS.includes(normalized)) {
    throw new AppError(400, 'invoiceDefaultPaymentTermDays is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: INVOICE_PAYMENT_TERM_DAYS },
    });
  }
  return normalized;
}

function normalizeCurrency(value, fallback = DEFAULT_INVOICE_SETTINGS.invoiceDefaultCurrency) {
  const normalized = asText(value || fallback).toUpperCase();
  if (!INVOICE_CURRENCIES.includes(normalized)) {
    throw new AppError(400, 'invoiceDefaultCurrency is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: INVOICE_CURRENCIES },
    });
  }
  return normalized;
}

function normalizeStockUpdateMode(value, fallback = DEFAULT_INVOICE_SETTINGS.invoiceStockUpdateMode) {
  const normalized = asText(value) || fallback;
  if (!INVOICE_STOCK_UPDATE_MODES.includes(normalized)) {
    throw new AppError(400, 'invoiceStockUpdateMode is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: INVOICE_STOCK_UPDATE_MODES },
    });
  }
  return normalized;
}

function normalizeAnnotationMode(value, fallback = DEFAULT_INVOICE_SETTINGS.invoiceAnnotationMode) {
  const normalized = asText(value) || fallback;
  if (!INVOICE_ANNOTATION_MODES.includes(normalized)) {
    throw new AppError(400, 'invoiceAnnotationMode is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: INVOICE_ANNOTATION_MODES },
    });
  }
  return normalized;
}

function sanitizeStyle(styleRaw) {
  const style = String(styleRaw || '').trim();
  if (!style) return '';

  const safe = [];
  style.split(';').forEach((chunk) => {
    const [propRaw, ...rest] = chunk.split(':');
    if (!propRaw || !rest.length) return;

    const prop = propRaw.trim().toLowerCase();
    const value = rest.join(':').trim().toLowerCase();
    if (prop === 'text-align' && TEXT_ALIGN_VALUES.has(value)) {
      safe.push(`text-align:${value}`);
    }
  });

  return safe.join(';');
}

function sanitizeAnchorAttr(name, value) {
  if (name === 'href') {
    const href = asText(value);
    if (!href || !SAFE_LINK_RE.test(href)) return null;
    return href;
  }
  if (name === 'target') {
    const normalized = asText(value).toLowerCase();
    return normalized === '_blank' ? '_blank' : null;
  }
  if (name === 'rel') {
    const normalized = asText(value).toLowerCase();
    return normalized || null;
  }
  return null;
}

function sanitizeAllowedTagAttrs(tagName, attrRaw) {
  const attrs = [];
  const source = String(attrRaw || '');
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/g;
  let match;

  while ((match = attrRegex.exec(source)) !== null) {
    const attrName = String(match[1] || '').toLowerCase();
    const attrValue = match[3] ?? match[4] ?? match[5] ?? '';
    if (!attrName || attrName.startsWith('on')) continue;

    if (attrName === 'style') {
      const safeStyle = sanitizeStyle(attrValue);
      if (safeStyle) attrs.push(`style="${safeStyle}"`);
      continue;
    }

    if (tagName === 'a') {
      const safe = sanitizeAnchorAttr(attrName, attrValue);
      if (safe) attrs.push(`${attrName}="${safe}"`);
    }
  }

  if (tagName === 'a') {
    const hasHref = attrs.some((attr) => attr.startsWith('href='));
    if (!hasHref) return '';

    const hasTargetBlank = attrs.includes('target="_blank"');
    const hasRel = attrs.some((attr) => attr.startsWith('rel='));
    if (hasTargetBlank && !hasRel) {
      attrs.push('rel="noopener noreferrer"');
    }
  }

  return attrs.length ? ` ${attrs.join(' ')}` : '';
}

function stripDangerousBlocks(html) {
  let output = String(html || '');
  FORBIDDEN_BLOCK_TAGS.forEach((tag) => {
    const block = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    const single = new RegExp(`<${tag}\\b[^>]*\\/?\\s*>`, 'gi');
    output = output.replace(block, '');
    output = output.replace(single, '');
  });
  return output;
}

function sanitizeAnnotationTemplateHtml(value) {
  if (value === undefined || value === null) return null;

  let html = String(value);
  if (!html.trim()) return null;

  if (html.length > MAX_TEMPLATE_HTML_LENGTH) {
    throw new AppError(400, `invoiceAnnotationTemplateHtml must be <= ${MAX_TEMPLATE_HTML_LENGTH} chars`, {
      code: 'VALIDATION_ERROR',
    });
  }

  html = stripDangerousBlocks(html);
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  html = html.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tagRaw, attrsRaw = '') => {
    const tag = String(tagRaw || '').toLowerCase();
    if (!ALLOWED_HTML_TAGS.has(tag)) return '';

    const trimmed = String(full).trim();
    if (trimmed.startsWith('</')) return `</${tag}>`;
    if (tag === 'br') return '<br>';

    const attrs = sanitizeAllowedTagAttrs(tag, attrsRaw);
    return `<${tag}${attrs}>`;
  });

  const trimmed = html.trim();
  return trimmed || null;
}

function normalizeSettingsShape(raw = {}) {
  return {
    invoiceDefaultType: INVOICE_DEFAULT_TYPE_KEYS.includes(raw?.invoiceDefaultType)
      ? raw.invoiceDefaultType
      : DEFAULT_INVOICE_SETTINGS.invoiceDefaultType,
    invoiceDefaultPaymentMethod: INVOICE_PAYMENT_METHODS.includes(raw?.invoiceDefaultPaymentMethod)
      ? raw.invoiceDefaultPaymentMethod
      : DEFAULT_INVOICE_SETTINGS.invoiceDefaultPaymentMethod,
    invoiceDefaultPaymentTermDays: INVOICE_PAYMENT_TERM_DAYS.includes(Number(raw?.invoiceDefaultPaymentTermDays))
      ? Number(raw.invoiceDefaultPaymentTermDays)
      : DEFAULT_INVOICE_SETTINGS.invoiceDefaultPaymentTermDays,
    invoiceDefaultCurrency: INVOICE_CURRENCIES.includes(asText(raw?.invoiceDefaultCurrency).toUpperCase())
      ? asText(raw?.invoiceDefaultCurrency).toUpperCase()
      : DEFAULT_INVOICE_SETTINGS.invoiceDefaultCurrency,
    invoiceStockUpdateMode: INVOICE_STOCK_UPDATE_MODES.includes(raw?.invoiceStockUpdateMode)
      ? raw.invoiceStockUpdateMode
      : DEFAULT_INVOICE_SETTINGS.invoiceStockUpdateMode,
    invoiceAnnotationMode: INVOICE_ANNOTATION_MODES.includes(raw?.invoiceAnnotationMode)
      ? raw.invoiceAnnotationMode
      : DEFAULT_INVOICE_SETTINGS.invoiceAnnotationMode,
    invoiceAnnotationTemplateHtml: asOptionalText(raw?.invoiceAnnotationTemplateHtml),
  };
}

function normalizeTypeState(rows = []) {
  const fromDb = new Map(
    (rows || []).map((row) => [String(row?.typeKey || ''), Boolean(row?.enabled)])
  );

  return INVOICE_TYPE_DEFINITIONS.map((definition) => ({
    ...definition,
    enabled: fromDb.has(definition.typeKey) ? Boolean(fromDb.get(definition.typeKey)) : definition.defaultEnabled,
  }));
}

function ensureHasEnabledType(typeState) {
  const enabledCount = (typeState || []).filter((entry) => entry.enabled).length;
  if (enabledCount <= 0) {
    throw new AppError(400, 'At least one invoice type must stay enabled', {
      code: 'VALIDATION_ERROR',
    });
  }
}

function ensureDefaultTypeEnabled(typeState, defaultType) {
  const row = (typeState || []).find((entry) => entry.typeKey === defaultType);
  if (!row || !row.enabled) {
    throw new AppError(400, 'invoiceDefaultType must point to an enabled invoice type', {
      code: 'VALIDATION_ERROR',
      details: { invoiceDefaultType: defaultType },
    });
  }
}

function stabilizeDefaultType(typeState, maybeType) {
  const preferred = normalizeInvoiceDefaultType(maybeType);
  const found = (typeState || []).find((entry) => entry.typeKey === preferred && entry.enabled);
  if (found) return found.typeKey;

  const firstEnabled = (typeState || []).find((entry) => entry.enabled);
  return firstEnabled?.typeKey || DEFAULT_INVOICE_SETTINGS.invoiceDefaultType;
}

function buildNumberingMap(numberingItems = []) {
  const map = new Map();
  (numberingItems || []).forEach((item) => {
    const key = String(item?.documentType || '').toUpperCase();
    if (key) map.set(key, item);
  });
  return map;
}

async function loadSettingsRows({ companyId, transaction = null }) {
  const [settingsRow, typeRows] = await Promise.all([
    CompanyInvoiceSetting.findOne({
      where: { companyId },
      transaction,
    }),
    CompanyInvoiceTypeSetting.findAll({
      where: { companyId },
      transaction,
    }),
  ]);

  return {
    settingsRow,
    typeRows,
  };
}

function normalizeUsageState({ settingsRow, typeRows }) {
  const settings = normalizeSettingsShape(settingsRow?.get ? settingsRow.get({ plain: true }) : settingsRow || {});
  const invoiceTypes = normalizeTypeState(typeRows || []);

  ensureHasEnabledType(invoiceTypes);

  const safeDefaultType = stabilizeDefaultType(invoiceTypes, settings.invoiceDefaultType);
  const safeAnnotationMode = normalizeAnnotationMode(settings.invoiceAnnotationMode);
  const safeTemplate = safeAnnotationMode === 'template'
    ? sanitizeAnnotationTemplateHtml(settings.invoiceAnnotationTemplateHtml)
    : null;

  return {
    invoiceDefaultType: safeDefaultType,
    invoiceDefaultPaymentMethod: normalizePaymentMethod(settings.invoiceDefaultPaymentMethod),
    invoiceDefaultPaymentTermDays: normalizePaymentTermDays(settings.invoiceDefaultPaymentTermDays),
    invoiceDefaultCurrency: normalizeCurrency(settings.invoiceDefaultCurrency),
    invoiceStockUpdateMode: normalizeStockUpdateMode(settings.invoiceStockUpdateMode),
    invoiceAnnotationMode: safeAnnotationMode,
    invoiceAnnotationTemplateHtml: safeTemplate,
    invoiceTypes,
  };
}

async function getCompanyInvoiceSettingsForUsage({ companyId, transaction = null } = {}) {
  ensureCompanyId(companyId);
  const rows = await loadSettingsRows({ companyId, transaction });
  return normalizeUsageState(rows);
}

async function getCompanyInvoiceSettings({ companyId, transaction = null } = {}) {
  ensureCompanyId(companyId);

  const usage = await getCompanyInvoiceSettingsForUsage({ companyId, transaction });
  const numberingItems = await listCompanyNumberingSettings({
    companyId,
    transaction,
  });
  const numberingMap = buildNumberingMap(numberingItems);

  return {
    invoiceDefaultType: usage.invoiceDefaultType,
    invoiceDefaultPaymentMethod: usage.invoiceDefaultPaymentMethod,
    invoiceDefaultPaymentTermDays: usage.invoiceDefaultPaymentTermDays,
    invoiceDefaultCurrency: usage.invoiceDefaultCurrency,
    invoiceStockUpdateMode: usage.invoiceStockUpdateMode,
    invoiceAnnotationMode: usage.invoiceAnnotationMode,
    invoiceAnnotationTemplateHtml: usage.invoiceAnnotationTemplateHtml,
    invoiceTypes: usage.invoiceTypes.map((entry) => {
      const numberingRow = numberingMap.get(entry.numberingSourceType);
      const nextSequence = normalizeSequenceForResponse(numberingRow?.nextSequence, 1);
      const lastSequence = Math.max(nextSequence - 1, 0);
      const numberPattern = numberingRow?.pattern
        ? backendPatternToUiPattern(numberingRow.pattern)
        : entry.fallbackPattern;

      const nextNumber = buildPreviewSafely({
        pattern: numberPattern,
        sequence: nextSequence,
        fallback: numberingRow?.nextNumberPreview || entry.fallbackNextNumber,
      });
      const lastNumber = lastSequence > 0
        ? buildPreviewSafely({
          pattern: numberPattern,
          sequence: lastSequence,
          fallback: numberingRow?.lastNumber || entry.fallbackLastNumber,
        })
        : '0';

      return {
        typeKey: entry.typeKey,
        label: entry.label,
        enabled: Boolean(entry.enabled),
        numberingType: entry.numberingType,
        numberPattern,
        lastSequence,
        lastNumber,
        nextSequence,
        nextNumber,
      };
    }),
  };
}

function applyTypeOverrides(baseTypeState, updates = []) {
  const updateMap = new Map();
  (updates || []).forEach((entry) => {
    const typeKey = asText(entry?.typeKey);
    if (!typeKey) return;
    if (!getInvoiceTypeDefinition(typeKey)) {
      throw new AppError(400, `invoiceTypes contains unknown typeKey "${typeKey}"`, {
        code: 'VALIDATION_ERROR',
      });
    }
    updateMap.set(typeKey, Boolean(entry?.enabled));
  });

  return (baseTypeState || []).map((entry) => ({
    ...entry,
    enabled: updateMap.has(entry.typeKey) ? Boolean(updateMap.get(entry.typeKey)) : Boolean(entry.enabled),
  }));
}

function collectTypePatternOverrides(updates = []) {
  const patternMap = new Map();
  (updates || []).forEach((entry) => {
    const typeKey = asText(entry?.typeKey);
    if (!typeKey) return;

    const definition = getInvoiceTypeDefinition(typeKey);
    if (!definition) return;

    if (hasOwn(entry, 'numberingType')) {
      const providedNumberingType = asText(entry?.numberingType).toUpperCase();
      if (providedNumberingType !== asText(definition.numberingType).toUpperCase()) {
        throw new AppError(400, `invoiceTypes.${typeKey}.numberingType is invalid`, {
          code: 'VALIDATION_ERROR',
        });
      }
    }

    if (!hasOwn(entry, 'numberPattern')) return;
    patternMap.set(
      typeKey,
      uiPatternToBackendPattern(entry.numberPattern, `invoiceTypes.${typeKey}.numberPattern`)
    );
  });
  return patternMap;
}

async function updateCompanyInvoiceSettings({ companyId, payload = {}, transaction = null } = {}) {
  ensureCompanyId(companyId);

  const ownTransaction = !transaction;
  const tx = transaction || (await CompanyInvoiceSetting.sequelize.transaction());
  try {
    const rows = await loadSettingsRows({ companyId, transaction: tx });
    const base = normalizeUsageState(rows);

    const nextTypeState = hasOwn(payload, 'invoiceTypes')
      ? applyTypeOverrides(base.invoiceTypes, payload?.invoiceTypes || [])
      : base.invoiceTypes;
    const typePatternOverrides = hasOwn(payload, 'invoiceTypes')
      ? collectTypePatternOverrides(payload?.invoiceTypes || [])
      : new Map();

    ensureHasEnabledType(nextTypeState);

    const nextDefaultType = normalizeInvoiceDefaultType(
      hasOwn(payload, 'invoiceDefaultType') ? payload?.invoiceDefaultType : base.invoiceDefaultType
    );
    ensureDefaultTypeEnabled(nextTypeState, nextDefaultType);

    const nextPaymentMethod = normalizePaymentMethod(
      hasOwn(payload, 'invoiceDefaultPaymentMethod')
        ? payload?.invoiceDefaultPaymentMethod
        : base.invoiceDefaultPaymentMethod
    );
    const nextPaymentTermDays = normalizePaymentTermDays(
      hasOwn(payload, 'invoiceDefaultPaymentTermDays')
        ? payload?.invoiceDefaultPaymentTermDays
        : base.invoiceDefaultPaymentTermDays
    );
    const nextCurrency = normalizeCurrency(
      hasOwn(payload, 'invoiceDefaultCurrency')
        ? payload?.invoiceDefaultCurrency
        : base.invoiceDefaultCurrency
    );
    const nextStockUpdateMode = normalizeStockUpdateMode(
      hasOwn(payload, 'invoiceStockUpdateMode')
        ? payload?.invoiceStockUpdateMode
        : base.invoiceStockUpdateMode
    );
    const nextAnnotationMode = normalizeAnnotationMode(
      hasOwn(payload, 'invoiceAnnotationMode')
        ? payload?.invoiceAnnotationMode
        : base.invoiceAnnotationMode
    );

    let templateSource;
    if (hasOwn(payload, 'invoiceAnnotationTemplateHtml')) {
      templateSource = payload?.invoiceAnnotationTemplateHtml;
    } else {
      templateSource = base.invoiceAnnotationTemplateHtml;
    }
    const nextTemplate = nextAnnotationMode === 'template'
      ? sanitizeAnnotationTemplateHtml(templateSource)
      : null;

    const settingsPayload = {
      companyId,
      invoiceDefaultType: nextDefaultType,
      invoiceDefaultPaymentMethod: nextPaymentMethod,
      invoiceDefaultPaymentTermDays: nextPaymentTermDays,
      invoiceDefaultCurrency: nextCurrency,
      invoiceStockUpdateMode: nextStockUpdateMode,
      invoiceAnnotationMode: nextAnnotationMode,
      invoiceAnnotationTemplateHtml: nextTemplate,
    };

    if (rows.settingsRow) {
      await rows.settingsRow.update(settingsPayload, { transaction: tx });
    } else {
      await CompanyInvoiceSetting.create(settingsPayload, { transaction: tx });
    }

    const existingTypeRows = new Map((rows.typeRows || []).map((row) => [row.typeKey, row]));
    for (const entry of nextTypeState) {
      const persisted = existingTypeRows.get(entry.typeKey);
      if (persisted) {
        // eslint-disable-next-line no-await-in-loop
        await persisted.update({ enabled: Boolean(entry.enabled) }, { transaction: tx });
      } else {
        // eslint-disable-next-line no-await-in-loop
        await CompanyInvoiceTypeSetting.create(
          {
            companyId,
            typeKey: entry.typeKey,
            enabled: Boolean(entry.enabled),
          },
          { transaction: tx }
        );
      }
    }

    for (const [typeKey, backendPattern] of typePatternOverrides.entries()) {
      const definition = getInvoiceTypeDefinition(typeKey);
      if (!definition) continue;

      // eslint-disable-next-line no-await-in-loop
      await updateCompanyNumberingSetting({
        companyId,
        documentType: definition.numberingSourceType,
        payload: {
          pattern: backendPattern,
        },
        transaction: tx,
      });
    }

    if (ownTransaction) {
      await tx.commit();
    }
    return getCompanyInvoiceSettings({ companyId });
  } catch (error) {
    if (ownTransaction) {
      await tx.rollback();
    }
    throw error;
  }
}

async function resolveSourceDocumentAnnotation({ companyId, sourceDocumentId, transaction = null } = {}) {
  const id = asText(sourceDocumentId);
  if (!id) return null;
  const source = await Document.findOne({
    where: {
      id,
      companyId,
    },
    attributes: ['id', 'notes'],
    transaction,
  });
  return asOptionalText(source?.notes);
}

function resolveInvoiceAnnotation({
  invoiceSettings,
  incomingAnnotation,
  sourceDocumentAnnotation = null,
  preferSettingsOverIncoming = false,
} = {}) {
  const safeSettings = invoiceSettings || DEFAULT_INVOICE_SETTINGS;
  const mode = normalizeAnnotationMode(
    safeSettings.invoiceAnnotationMode,
    DEFAULT_INVOICE_SETTINGS.invoiceAnnotationMode
  );

  if (!preferSettingsOverIncoming && incomingAnnotation !== undefined) {
    return asOptionalText(incomingAnnotation);
  }

  if (mode === 'empty') return null;
  if (mode === 'copy_from_documents') return asOptionalText(sourceDocumentAnnotation);
  if (mode === 'template') return asOptionalText(safeSettings.invoiceAnnotationTemplateHtml);
  return null;
}

function shouldCreateWarehouseDocument(invoiceSettings = {}) {
  const mode = normalizeStockUpdateMode(
    invoiceSettings?.invoiceStockUpdateMode,
    DEFAULT_INVOICE_SETTINGS.invoiceStockUpdateMode
  );
  return mode === 'create_warehouse_document';
}

function resolveNumberingTypeForInvoiceDefaults(invoiceSettings = {}) {
  const typeKey = normalizeInvoiceDefaultType(
    invoiceSettings?.invoiceDefaultType,
    DEFAULT_INVOICE_SETTINGS.invoiceDefaultType
  );
  const definition = getInvoiceTypeDefinition(typeKey) || getInvoiceTypeDefinition('invoice');
  return {
    typeKey: definition.typeKey,
    numberingType: definition.numberingType,
    numberingSourceType: definition.numberingSourceType,
  };
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

module.exports = {
  getCompanyInvoiceSettings,
  getCompanyInvoiceSettingsForUsage,
  updateCompanyInvoiceSettings,
  sanitizeAnnotationTemplateHtml,
  resolveInvoiceAnnotation,
  resolveSourceDocumentAnnotation,
  shouldCreateWarehouseDocument,
  resolveNumberingTypeForInvoiceDefaults,
};
