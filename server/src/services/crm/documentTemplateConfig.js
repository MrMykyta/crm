'use strict';

const { DOCUMENT_TYPES, normalizeDocumentType } = require('./documentNumberingConfig');

const LAYOUT_DENSITIES = Object.freeze(['compact', 'comfortable', 'spacious']);

const TEMPLATE_SECTION_KEYS = Object.freeze([
  'header',
  'seller_buyer',
  'items',
  'totals',
  'payment',
  'terms',
  'notes',
  'source_reference',
]);

const TEMPLATE_SECTION_ALIASES = Object.freeze({
  parties: 'seller_buyer',
  summary: 'totals',
  source: 'source_reference',
});

const INVOICE_SECTION_ORDER = Object.freeze([
  'header',
  'seller_buyer',
  'items',
  'totals',
  'payment',
  'terms',
  'notes',
  'source_reference',
]);

const QUOTE_SECTION_ORDER = Object.freeze([
  'header',
  'seller_buyer',
  'items',
  'totals',
  'terms',
  'notes',
  'source_reference',
]);

const ORDER_SECTION_ORDER = Object.freeze([
  'header',
  'seller_buyer',
  'items',
  'totals',
  'terms',
  'notes',
  'source_reference',
]);

const RECEIPT_SECTION_ORDER = Object.freeze([
  'header',
  'seller_buyer',
  'items',
  'totals',
  'payment',
  'notes',
  'source_reference',
]);

const CONTRACT_SECTION_ORDER = Object.freeze([
  'header',
  'seller_buyer',
  'items',
  'totals',
  'terms',
  'notes',
  'source_reference',
]);

const TEMPLATE_BOOLEAN_FIELDS = Object.freeze([
  'showLogo',
  'showSellerBlock',
  'showBuyerBlock',
  'showPaymentBlock',
  'showNotesBlock',
  'showSourceReference',
  'showVatSummary',
  'showStatusBadge',
  'showTermsBlock',
  'showSellerName',
  'showSellerAddress',
  'showSellerPostalCity',
  'showSellerCountry',
  'showSellerNip',
  'showSellerEmail',
  'showSellerPhone',
  'showSellerBank',
  'showSellerBankAccount',
  'showSellerWebsite',
  'showBuyerName',
  'showBuyerAddress',
  'showBuyerPostalCity',
  'showBuyerCountry',
  'showBuyerNip',
  'showBuyerEmail',
  'showBuyerPhone',
]);

const TEMPLATE_BOOLEAN_DEFAULTS = Object.freeze({
  showLogo: false,
  showSellerBlock: true,
  showBuyerBlock: true,
  showPaymentBlock: false,
  showNotesBlock: true,
  showSourceReference: false,
  showVatSummary: true,
  showStatusBadge: true,
  showTermsBlock: true,
  showSellerName: true,
  showSellerAddress: true,
  showSellerPostalCity: true,
  showSellerCountry: true,
  showSellerNip: true,
  showSellerEmail: true,
  showSellerPhone: true,
  showSellerBank: true,
  showSellerBankAccount: true,
  showSellerWebsite: true,
  showBuyerName: true,
  showBuyerAddress: true,
  showBuyerPostalCity: true,
  showBuyerCountry: true,
  showBuyerNip: true,
  showBuyerEmail: true,
  showBuyerPhone: true,
});

const TEMPLATE_PRESETS = Object.freeze({
  classic_invoice: Object.freeze({
    key: 'classic_invoice',
    label: 'Classic Invoice',
    category: 'invoice',
    allowedTypes: Object.freeze(['INVOICE', 'BILL']),
    sectionOrder: INVOICE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'comfortable',
      showLogo: true,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: true,
      showNotesBlock: true,
      showSourceReference: false,
      showVatSummary: true,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
  compact_invoice: Object.freeze({
    key: 'compact_invoice',
    label: 'Compact Invoice',
    category: 'invoice',
    allowedTypes: Object.freeze(['INVOICE', 'BILL']),
    sectionOrder: INVOICE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'compact',
      showLogo: false,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: true,
      showNotesBlock: false,
      showSourceReference: true,
      showVatSummary: true,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
  modern_invoice: Object.freeze({
    key: 'modern_invoice',
    label: 'Modern Invoice',
    category: 'invoice',
    allowedTypes: Object.freeze(['INVOICE', 'BILL']),
    sectionOrder: INVOICE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'spacious',
      showLogo: true,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: true,
      showNotesBlock: true,
      showSourceReference: true,
      showVatSummary: true,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
  quote_classic: Object.freeze({
    key: 'quote_classic',
    label: 'Quote Classic',
    category: 'quote',
    allowedTypes: Object.freeze(['QUOTE']),
    sectionOrder: QUOTE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'comfortable',
      showLogo: true,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: false,
      showNotesBlock: true,
      showSourceReference: true,
      showVatSummary: true,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
  quote_compact: Object.freeze({
    key: 'quote_compact',
    label: 'Quote Compact',
    category: 'quote',
    allowedTypes: Object.freeze(['QUOTE']),
    sectionOrder: QUOTE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'compact',
      showLogo: false,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: false,
      showNotesBlock: true,
      showSourceReference: true,
      showVatSummary: true,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
  order_standard: Object.freeze({
    key: 'order_standard',
    label: 'Order Standard',
    category: 'order',
    allowedTypes: Object.freeze(['ORDER']),
    sectionOrder: ORDER_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'comfortable',
      showLogo: true,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: false,
      showNotesBlock: true,
      showSourceReference: true,
      showVatSummary: true,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
  order_compact: Object.freeze({
    key: 'order_compact',
    label: 'Order Compact',
    category: 'order',
    allowedTypes: Object.freeze(['ORDER']),
    sectionOrder: ORDER_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'compact',
      showLogo: false,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: false,
      showNotesBlock: false,
      showSourceReference: true,
      showVatSummary: true,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
  receipt_simple: Object.freeze({
    key: 'receipt_simple',
    label: 'Receipt Simple',
    category: 'receipt',
    allowedTypes: Object.freeze(['RECEIPT']),
    sectionOrder: RECEIPT_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'comfortable',
      showLogo: false,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: true,
      showNotesBlock: false,
      showSourceReference: false,
      showVatSummary: false,
      showStatusBadge: true,
      showTermsBlock: false,
    }),
  }),
  receipt_compact: Object.freeze({
    key: 'receipt_compact',
    label: 'Receipt Compact',
    category: 'receipt',
    allowedTypes: Object.freeze(['RECEIPT']),
    sectionOrder: RECEIPT_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'compact',
      showLogo: false,
      showSellerBlock: false,
      showBuyerBlock: true,
      showPaymentBlock: true,
      showNotesBlock: false,
      showSourceReference: false,
      showVatSummary: false,
      showStatusBadge: true,
      showTermsBlock: false,
    }),
  }),
  contract_standard: Object.freeze({
    key: 'contract_standard',
    label: 'Contract Standard',
    category: 'contract',
    allowedTypes: Object.freeze(['CONTRACT']),
    sectionOrder: CONTRACT_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'comfortable',
      showLogo: true,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: false,
      showNotesBlock: true,
      showSourceReference: true,
      showVatSummary: false,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
  contract_minimal: Object.freeze({
    key: 'contract_minimal',
    label: 'Contract Minimal',
    category: 'contract',
    allowedTypes: Object.freeze(['CONTRACT']),
    sectionOrder: CONTRACT_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: 'compact',
      showLogo: false,
      showSellerBlock: true,
      showBuyerBlock: true,
      showPaymentBlock: false,
      showNotesBlock: true,
      showSourceReference: false,
      showVatSummary: false,
      showStatusBadge: true,
      showTermsBlock: true,
    }),
  }),
});

const DEFAULT_PRESET_BY_TYPE = Object.freeze({
  QUOTE: 'quote_classic',
  ORDER: 'order_standard',
  INVOICE: 'classic_invoice',
  BILL: 'compact_invoice',
  RECEIPT: 'receipt_simple',
  CONTRACT: 'contract_standard',
});

const MAX_DOCUMENT_TITLE_OVERRIDE = 120;

function getPresetByKey(key) {
  const normalized = String(key || '').trim();
  return TEMPLATE_PRESETS[normalized] || null;
}

function listPresetsForType(documentType) {
  const normalizedType = normalizeDocumentType(documentType);
  return Object.values(TEMPLATE_PRESETS).filter((preset) => preset.allowedTypes.includes(normalizedType));
}

function isPresetAllowedForType(documentType, presetKey) {
  const preset = getPresetByKey(presetKey);
  const normalizedType = normalizeDocumentType(documentType);
  if (!preset) return false;
  return preset.allowedTypes.includes(normalizedType);
}

function resolvePresetForType(documentType, presetKey) {
  const normalizedType = normalizeDocumentType(documentType);
  if (isPresetAllowedForType(normalizedType, presetKey)) {
    return String(presetKey).trim();
  }
  return DEFAULT_PRESET_BY_TYPE[normalizedType] || DEFAULT_PRESET_BY_TYPE.QUOTE;
}

function toCanonicalSectionKey(key) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!normalized) return '';
  if (TEMPLATE_SECTION_KEYS.includes(normalized)) return normalized;
  return TEMPLATE_SECTION_ALIASES[normalized] || '';
}

function getTemplateSectionOrder(documentType, presetKey) {
  const resolvedPresetKey = resolvePresetForType(documentType, presetKey);
  const preset = getPresetByKey(resolvedPresetKey);
  const sectionOrder = Array.isArray(preset?.sectionOrder) ? preset.sectionOrder : TEMPLATE_SECTION_KEYS;
  return sectionOrder.filter((sectionKey) => TEMPLATE_SECTION_KEYS.includes(sectionKey));
}

function normalizeTemplateSectionOrder(sectionOrder, { documentType, presetKey } = {}) {
  const fallbackOrder = getTemplateSectionOrder(documentType, presetKey);
  const raw = Array.isArray(sectionOrder) ? sectionOrder : [];
  const seen = new Set();
  const normalized = [];

  raw.forEach((sectionKey) => {
    const canonicalKey = toCanonicalSectionKey(sectionKey);
    if (!canonicalKey || seen.has(canonicalKey)) return;
    seen.add(canonicalKey);
    normalized.push(canonicalKey);
  });

  fallbackOrder.forEach((sectionKey) => {
    if (seen.has(sectionKey)) return;
    seen.add(sectionKey);
    normalized.push(sectionKey);
  });

  TEMPLATE_SECTION_KEYS.forEach((sectionKey) => {
    if (seen.has(sectionKey)) return;
    seen.add(sectionKey);
    normalized.push(sectionKey);
  });

  return normalized;
}

function resolveTemplateSectionOrder(documentType, presetKey, sectionOrder) {
  const resolvedPresetKey = resolvePresetForType(documentType, presetKey);
  return normalizeTemplateSectionOrder(sectionOrder, {
    documentType,
    presetKey: resolvedPresetKey,
  });
}

function buildDefaultTemplateSetting(documentType) {
  const normalizedType = normalizeDocumentType(documentType);
  const safeType = DOCUMENT_TYPES.includes(normalizedType) ? normalizedType : 'QUOTE';
  const presetKey = resolvePresetForType(safeType, DEFAULT_PRESET_BY_TYPE[safeType]);
  const preset = getPresetByKey(presetKey);
  const defaults = preset ? preset.defaults : {};

  const booleanDefaults = TEMPLATE_BOOLEAN_FIELDS.reduce((acc, fieldName) => {
    if (typeof defaults[fieldName] === 'boolean') {
      acc[fieldName] = defaults[fieldName];
      return acc;
    }
    acc[fieldName] = TEMPLATE_BOOLEAN_DEFAULTS[fieldName];
    return acc;
  }, {});

  return {
    documentType: safeType,
    templatePreset: presetKey,
    documentTitleOverride: '',
    layoutDensity: defaults.layoutDensity || 'comfortable',
    sectionOrder: getTemplateSectionOrder(safeType, presetKey),
    ...booleanDefaults,
  };
}

module.exports = {
  DOCUMENT_TYPES,
  LAYOUT_DENSITIES,
  TEMPLATE_SECTION_KEYS,
  TEMPLATE_PRESETS,
  DEFAULT_PRESET_BY_TYPE,
  MAX_DOCUMENT_TITLE_OVERRIDE,
  TEMPLATE_BOOLEAN_FIELDS,
  TEMPLATE_BOOLEAN_DEFAULTS,
  normalizeDocumentType,
  getPresetByKey,
  listPresetsForType,
  isPresetAllowedForType,
  resolvePresetForType,
  getTemplateSectionOrder,
  normalizeTemplateSectionOrder,
  resolveTemplateSectionOrder,
  buildDefaultTemplateSetting,
};
