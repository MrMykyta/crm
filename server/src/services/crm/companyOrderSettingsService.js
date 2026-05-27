'use strict';

const AppError = require('../../errors/AppError');
const { CompanyOrderSetting } = require('../../models');
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
  ORDER_PRODUCT_RESERVATION_MODES,
  ORDER_ANNOTATION_MODES,
  DEFAULT_ORDER_SETTINGS,
} = require('./orderSettingsConfig');

const MAX_TEMPLATE_HTML_LENGTH = 20000;
const FORBIDDEN_BLOCK_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'meta',
  'link',
  'form',
  'input',
  'button',
  'textarea',
  'select',
];
const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'div', 'span', 'ul', 'ol', 'li']);
const TEXT_ALIGN_VALUES = new Set(['left', 'center', 'right']);
const SAFE_LINK_RE = /^(https?:|mailto:|tel:|\/|#|\.\.?\/)/i;
const ORDER_NUMBERING_TYPE = 'ORDER';
const ORDER_NUMBERING_FALLBACK_PATTERN = 'ZAM/{YYYY}/{MM}/{SEQ:4}';

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

function normalizeReservationMode(value, fallback = DEFAULT_ORDER_SETTINGS.orderProductReservationMode) {
  const normalized = asText(value) || fallback;
  if (!ORDER_PRODUCT_RESERVATION_MODES.includes(normalized)) {
    throw new AppError(400, 'orderProductReservationMode is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: ORDER_PRODUCT_RESERVATION_MODES },
    });
  }
  return normalized;
}

function normalizeAnnotationMode(value, fallback = DEFAULT_ORDER_SETTINGS.orderAnnotationMode) {
  const normalized = asText(value) || fallback;
  if (!ORDER_ANNOTATION_MODES.includes(normalized)) {
    throw new AppError(400, 'orderAnnotationMode is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: ORDER_ANNOTATION_MODES },
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
    throw new AppError(400, `orderAnnotationTemplateHtml must be <= ${MAX_TEMPLATE_HTML_LENGTH} chars`, {
      code: 'VALIDATION_ERROR',
    });
  }

  html = stripDangerousBlocks(html);
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  html = html.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tagRaw, attrsRaw = '') => {
    const tag = String(tagRaw || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';

    const trimmed = String(full).trim();
    if (trimmed.startsWith('</')) return `</${tag}>`;
    if (tag === 'br') return '<br>';

    const attrs = sanitizeAllowedTagAttrs(tag, attrsRaw);
    return `<${tag}${attrs}>`;
  });

  const trimmed = html.trim();
  return trimmed || null;
}

function normalizeOrderSettings(raw = {}) {
  const orderProductReservationMode = ORDER_PRODUCT_RESERVATION_MODES.includes(raw?.orderProductReservationMode)
    ? raw.orderProductReservationMode
    : DEFAULT_ORDER_SETTINGS.orderProductReservationMode;

  const orderAnnotationMode = ORDER_ANNOTATION_MODES.includes(raw?.orderAnnotationMode)
    ? raw.orderAnnotationMode
    : DEFAULT_ORDER_SETTINGS.orderAnnotationMode;

  let orderAnnotationTemplateHtml = asOptionalText(raw?.orderAnnotationTemplateHtml);
  if (orderAnnotationMode !== 'template') {
    orderAnnotationTemplateHtml = null;
  } else {
    try {
      orderAnnotationTemplateHtml = sanitizeAnnotationTemplateHtml(orderAnnotationTemplateHtml);
    } catch (_error) {
      orderAnnotationTemplateHtml = null;
    }
  }

  return {
    orderProductReservationMode,
    orderAnnotationMode,
    orderAnnotationTemplateHtml,
  };
}

function resolveOrderNumbering(numberingItems = []) {
  const orderNumbering = (numberingItems || []).find(
    (item) => String(item?.documentType || '').toUpperCase() === ORDER_NUMBERING_TYPE
  );

  const nextSequence = normalizeSequenceForResponse(orderNumbering?.nextSequence, 1);
  const lastSequence = Math.max(nextSequence - 1, 0);
  const resolvedPattern = asText(orderNumbering?.pattern) || ORDER_NUMBERING_FALLBACK_PATTERN;
  const numberPattern = backendPatternToUiPattern(resolvedPattern);
  const nextNumber = buildPreviewSafely({
    pattern: numberPattern,
    sequence: nextSequence,
    fallback: orderNumbering?.nextNumberPreview,
  });
  const lastNumber = lastSequence > 0
    ? buildPreviewSafely({
      pattern: numberPattern,
      sequence: lastSequence,
      fallback: orderNumbering?.lastNumber,
    })
    : '0';

  return {
    numberingType: ORDER_NUMBERING_TYPE,
    numberPattern,
    lastSequence,
    lastNumber,
    nextSequence,
    nextNumber,
  };
}

async function getCompanyOrderSettings({ companyId, transaction = null } = {}) {
  ensureCompanyId(companyId);

  const [row, numberingItems] = await Promise.all([
    CompanyOrderSetting.findOne({
      where: { companyId },
      transaction,
    }),
    listCompanyNumberingSettings({
      companyId,
      transaction,
    }),
  ]);

  const settings = row
    ? normalizeOrderSettings(row.get({ plain: true }))
    : normalizeOrderSettings(DEFAULT_ORDER_SETTINGS);

  return {
    ...settings,
    orderNumbering: resolveOrderNumbering(numberingItems),
  };
}

async function updateCompanyOrderSettings({ companyId, payload = {}, transaction = null } = {}) {
  ensureCompanyId(companyId);

  const ownTransaction = !transaction;
  const tx = transaction || (await CompanyOrderSetting.sequelize.transaction());
  try {
    const existing = await CompanyOrderSetting.findOne({
      where: { companyId },
      transaction: tx,
    });

    const base = normalizeOrderSettings(existing?.get({ plain: true }) || DEFAULT_ORDER_SETTINGS);

    const orderProductReservationMode = normalizeReservationMode(
      payload.orderProductReservationMode,
      base.orderProductReservationMode
    );
    const orderAnnotationMode = normalizeAnnotationMode(payload.orderAnnotationMode, base.orderAnnotationMode);

    let templateSource;
    if (Object.prototype.hasOwnProperty.call(payload, 'orderAnnotationTemplateHtml')) {
      templateSource = payload.orderAnnotationTemplateHtml;
    } else {
      templateSource = base.orderAnnotationTemplateHtml;
    }

    const orderAnnotationTemplateHtml = orderAnnotationMode === 'template'
      ? sanitizeAnnotationTemplateHtml(templateSource)
      : null;

    const toPersist = {
      companyId,
      orderProductReservationMode,
      orderAnnotationMode,
      orderAnnotationTemplateHtml,
    };

    if (existing) {
      await existing.update(toPersist, { transaction: tx });
    } else {
      await CompanyOrderSetting.create(toPersist, { transaction: tx });
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'orderNumbering')) {
      const numberingPayload = payload.orderNumbering || {};
      const numberingType = asText(numberingPayload.numberingType || ORDER_NUMBERING_TYPE).toUpperCase();
      if (numberingType !== ORDER_NUMBERING_TYPE) {
        throw new AppError(400, 'orderNumbering.numberingType is invalid', {
          code: 'VALIDATION_ERROR',
        });
      }

      const backendPattern = uiPatternToBackendPattern(
        numberingPayload.numberPattern,
        'orderNumbering.numberPattern'
      );

      await updateCompanyNumberingSetting({
        companyId,
        documentType: ORDER_NUMBERING_TYPE,
        payload: { pattern: backendPattern },
        transaction: tx,
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

  return getCompanyOrderSettings({ companyId });
}

function shouldReserveProducts(orderSettings) {
  return normalizeOrderSettings(orderSettings).orderProductReservationMode === 'enabled';
}

function resolveOrderAnnotation({
  orderSettings,
  incomingAnnotation,
  sourceDocumentAnnotation = null,
} = {}) {
  if (incomingAnnotation !== undefined) {
    return asOptionalText(incomingAnnotation);
  }

  const settings = normalizeOrderSettings(orderSettings || DEFAULT_ORDER_SETTINGS);

  if (settings.orderAnnotationMode === 'empty') {
    return null;
  }

  if (settings.orderAnnotationMode === 'copy_from_documents') {
    return asOptionalText(sourceDocumentAnnotation);
  }

  if (settings.orderAnnotationMode === 'template') {
    return settings.orderAnnotationTemplateHtml;
  }

  return null;
}

module.exports = {
  getCompanyOrderSettings,
  updateCompanyOrderSettings,
  resolveOrderAnnotation,
  shouldReserveProducts,
  normalizeOrderSettings,
  sanitizeAnnotationTemplateHtml,
};
