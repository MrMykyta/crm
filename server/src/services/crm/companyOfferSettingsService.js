'use strict';

const AppError = require('../../errors/AppError');
const { CompanyOfferSetting } = require('../../models');
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
  OFFER_ANNOTATION_MODES,
  DEFAULT_OFFER_SETTINGS,
  OFFER_NUMBERING_FALLBACK,
} = require('./offerSettingsConfig');

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

function normalizeAnnotationMode(value, fallback = DEFAULT_OFFER_SETTINGS.offerAnnotationMode) {
  const normalized = asText(value) || fallback;
  if (!OFFER_ANNOTATION_MODES.includes(normalized)) {
    throw new AppError(400, 'offerAnnotationMode is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: OFFER_ANNOTATION_MODES },
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

function sanitizeOfferAnnotationTemplateHtml(value) {
  if (value === undefined || value === null) return null;

  let html = String(value);
  if (!html.trim()) return null;

  if (html.length > MAX_TEMPLATE_HTML_LENGTH) {
    throw new AppError(400, `offerAnnotationTemplateHtml must be <= ${MAX_TEMPLATE_HTML_LENGTH} chars`, {
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

function normalizeOfferSettings(raw = {}) {
  const offerAnnotationMode = OFFER_ANNOTATION_MODES.includes(raw?.offerAnnotationMode)
    ? raw.offerAnnotationMode
    : DEFAULT_OFFER_SETTINGS.offerAnnotationMode;

  let offerAnnotationTemplateHtml = asOptionalText(raw?.offerAnnotationTemplateHtml);
  if (offerAnnotationMode !== 'template') {
    offerAnnotationTemplateHtml = null;
  } else {
    try {
      offerAnnotationTemplateHtml = sanitizeOfferAnnotationTemplateHtml(offerAnnotationTemplateHtml);
    } catch (_error) {
      offerAnnotationTemplateHtml = null;
    }
  }

  return {
    offerAnnotationMode,
    offerAnnotationTemplateHtml,
  };
}

function resolveOfferNumbering(numberingItems = []) {
  const quoteNumbering = (numberingItems || []).find((item) => {
    const type = String(item?.documentType || '').toUpperCase();
    return type === 'QUOTE' || type === 'OFFER';
  });

  const nextSequence = normalizeSequenceForResponse(quoteNumbering?.nextSequence, 1);
  const lastSequence = Math.max(nextSequence - 1, 0);
  const numberPattern = quoteNumbering?.pattern
    ? backendPatternToUiPattern(quoteNumbering.pattern)
    : OFFER_NUMBERING_FALLBACK.numberPattern;

  const nextNumber = buildPreviewSafely({
    pattern: numberPattern,
    sequence: nextSequence,
    fallback: quoteNumbering?.nextNumberPreview || OFFER_NUMBERING_FALLBACK.nextNumber,
  });
  const lastNumber = lastSequence > 0
    ? buildPreviewSafely({
      pattern: numberPattern,
      sequence: lastSequence,
      fallback: quoteNumbering?.lastNumber || OFFER_NUMBERING_FALLBACK.lastNumber,
    })
    : '0';

  if (!quoteNumbering) {
    // TODO(offer-numbering): remove fallback once QUOTE/OFFER numbering is guaranteed in company numbering settings.
    return {
      typeKey: OFFER_NUMBERING_FALLBACK.typeKey,
      label: OFFER_NUMBERING_FALLBACK.label,
      numberingType: OFFER_NUMBERING_FALLBACK.numberingType,
      numberPattern,
      lastSequence: 0,
      lastNumber: '0',
      nextSequence: 1,
      nextNumber,
    };
  }

  return {
    typeKey: OFFER_NUMBERING_FALLBACK.typeKey,
    label: OFFER_NUMBERING_FALLBACK.label,
    numberingType: OFFER_NUMBERING_FALLBACK.numberingType,
    numberPattern,
    lastSequence,
    lastNumber,
    nextSequence,
    nextNumber,
  };
}

async function getCompanyOfferSettingsForUsage({ companyId, transaction = null } = {}) {
  ensureCompanyId(companyId);

  const row = await CompanyOfferSetting.findOne({
    where: { companyId },
    transaction,
  });

  return normalizeOfferSettings(row?.get ? row.get({ plain: true }) : row || DEFAULT_OFFER_SETTINGS);
}

async function getCompanyOfferSettings({ companyId, transaction = null } = {}) {
  ensureCompanyId(companyId);

  const [settings, numberingItems] = await Promise.all([
    getCompanyOfferSettingsForUsage({ companyId, transaction }),
    listCompanyNumberingSettings({
      companyId,
      transaction,
    }),
  ]);

  return {
    ...settings,
    offerNumbering: resolveOfferNumbering(numberingItems),
  };
}

async function updateCompanyOfferSettings({ companyId, payload = {}, transaction = null } = {}) {
  ensureCompanyId(companyId);

  const ownTransaction = !transaction;
  const tx = transaction || (await CompanyOfferSetting.sequelize.transaction());
  try {
    const existing = await CompanyOfferSetting.findOne({
      where: { companyId },
      transaction: tx,
    });

    const base = normalizeOfferSettings(existing?.get({ plain: true }) || DEFAULT_OFFER_SETTINGS);

    const offerAnnotationMode = normalizeAnnotationMode(payload.offerAnnotationMode, base.offerAnnotationMode);

    let templateSource;
    if (Object.prototype.hasOwnProperty.call(payload, 'offerAnnotationTemplateHtml')) {
      templateSource = payload.offerAnnotationTemplateHtml;
    } else {
      templateSource = base.offerAnnotationTemplateHtml;
    }

    const offerAnnotationTemplateHtml = offerAnnotationMode === 'template'
      ? sanitizeOfferAnnotationTemplateHtml(templateSource)
      : null;

    const toPersist = {
      companyId,
      offerAnnotationMode,
      offerAnnotationTemplateHtml,
    };

    if (existing) {
      await existing.update(toPersist, { transaction: tx });
    } else {
      await CompanyOfferSetting.create(toPersist, { transaction: tx });
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'offerNumbering')) {
      const numberingPayload = payload.offerNumbering || {};
      const numberingType = asText(numberingPayload.numberingType || OFFER_NUMBERING_FALLBACK.numberingType)
        .toUpperCase();
      if (numberingType !== OFFER_NUMBERING_FALLBACK.numberingType) {
        throw new AppError(400, 'offerNumbering.numberingType is invalid', {
          code: 'VALIDATION_ERROR',
        });
      }

      const backendPattern = uiPatternToBackendPattern(
        numberingPayload.numberPattern,
        'offerNumbering.numberPattern'
      );

      await updateCompanyNumberingSetting({
        companyId,
        documentType: OFFER_NUMBERING_FALLBACK.numberingSourceType,
        payload: {
          pattern: backendPattern,
        },
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

  return getCompanyOfferSettings({ companyId });
}

function resolveOfferAnnotation({
  offerSettings,
  incomingAnnotation,
  sourceDocumentAnnotation = null,
  preferSettingsOverIncoming = false,
} = {}) {
  if (!preferSettingsOverIncoming && incomingAnnotation !== undefined) {
    return asOptionalText(incomingAnnotation);
  }

  const settings = normalizeOfferSettings(offerSettings || DEFAULT_OFFER_SETTINGS);

  if (settings.offerAnnotationMode === 'empty') {
    return null;
  }

  if (settings.offerAnnotationMode === 'copy_from_documents') {
    return asOptionalText(sourceDocumentAnnotation);
  }

  if (settings.offerAnnotationMode === 'template') {
    return settings.offerAnnotationTemplateHtml;
  }

  return null;
}

module.exports = {
  getCompanyOfferSettings,
  getCompanyOfferSettingsForUsage,
  updateCompanyOfferSettings,
  resolveOfferAnnotation,
  sanitizeOfferAnnotationTemplateHtml,
};
