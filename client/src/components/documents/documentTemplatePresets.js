import { DOCUMENT_TYPES } from "./documentTypeConfig";

export const TEMPLATE_LAYOUT_DENSITIES = Object.freeze(["compact", "comfortable", "spacious"]);

export const TEMPLATE_SECTION_KEYS = Object.freeze([
  "header",
  "seller_buyer",
  "items",
  "totals",
  "payment",
  "terms",
  "notes",
  "source_reference",
]);

export const TEMPLATE_SECTION_LABELS = Object.freeze({
  header: "Шапка документа",
  seller_buyer: "Продавец и покупатель",
  items: "Позиции",
  totals: "Итоги",
  payment: "Оплата",
  terms: "Условия",
  notes: "Примечание",
  source_reference: "Источник",
});

const TEMPLATE_SECTION_ALIASES = Object.freeze({
  parties: "seller_buyer",
  summary: "totals",
  source: "source_reference",
});

const INVOICE_SECTION_ORDER = Object.freeze([
  "header",
  "seller_buyer",
  "items",
  "totals",
  "payment",
  "terms",
  "notes",
  "source_reference",
]);
const QUOTE_SECTION_ORDER = Object.freeze([
  "header",
  "seller_buyer",
  "items",
  "totals",
  "terms",
  "notes",
  "source_reference",
]);
const ORDER_SECTION_ORDER = Object.freeze([
  "header",
  "seller_buyer",
  "items",
  "totals",
  "terms",
  "notes",
  "source_reference",
]);
const RECEIPT_SECTION_ORDER = Object.freeze([
  "header",
  "seller_buyer",
  "items",
  "totals",
  "payment",
  "notes",
  "source_reference",
]);
const CONTRACT_SECTION_ORDER = Object.freeze([
  "header",
  "seller_buyer",
  "items",
  "totals",
  "terms",
  "notes",
  "source_reference",
]);

export const DOCUMENT_TEMPLATE_PRESETS = Object.freeze({
  classic_invoice: Object.freeze({
    key: "classic_invoice",
    label: "Classic Invoice",
    category: "invoice",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    sectionOrder: INVOICE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "comfortable",
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
    key: "compact_invoice",
    label: "Compact Invoice",
    category: "invoice",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    sectionOrder: INVOICE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "compact",
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
    key: "modern_invoice",
    label: "Modern Invoice",
    category: "invoice",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    sectionOrder: INVOICE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "spacious",
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
    key: "quote_classic",
    label: "Quote Classic",
    category: "quote",
    allowedTypes: Object.freeze(["QUOTE"]),
    sectionOrder: QUOTE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "comfortable",
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
    key: "quote_compact",
    label: "Quote Compact",
    category: "quote",
    allowedTypes: Object.freeze(["QUOTE"]),
    sectionOrder: QUOTE_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "compact",
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
    key: "order_standard",
    label: "Order Standard",
    category: "order",
    allowedTypes: Object.freeze(["ORDER"]),
    sectionOrder: ORDER_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "comfortable",
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
    key: "order_compact",
    label: "Order Compact",
    category: "order",
    allowedTypes: Object.freeze(["ORDER"]),
    sectionOrder: ORDER_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "compact",
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
    key: "receipt_simple",
    label: "Receipt Simple",
    category: "receipt",
    allowedTypes: Object.freeze(["RECEIPT"]),
    sectionOrder: RECEIPT_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "comfortable",
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
    key: "receipt_compact",
    label: "Receipt Compact",
    category: "receipt",
    allowedTypes: Object.freeze(["RECEIPT"]),
    sectionOrder: RECEIPT_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "compact",
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
    key: "contract_standard",
    label: "Contract Standard",
    category: "contract",
    allowedTypes: Object.freeze(["CONTRACT"]),
    sectionOrder: CONTRACT_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "comfortable",
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
    key: "contract_minimal",
    label: "Contract Minimal",
    category: "contract",
    allowedTypes: Object.freeze(["CONTRACT"]),
    sectionOrder: CONTRACT_SECTION_ORDER,
    defaults: Object.freeze({
      layoutDensity: "compact",
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

export const DEFAULT_TEMPLATE_PRESET_BY_TYPE = Object.freeze({
  QUOTE: "quote_classic",
  ORDER: "order_standard",
  INVOICE: "classic_invoice",
  BILL: "compact_invoice",
  RECEIPT: "receipt_simple",
  CONTRACT: "contract_standard",
});

export const TEMPLATE_BLOCK_TOGGLE_FIELDS = Object.freeze([
  "showLogo",
  "showSellerBlock",
  "showBuyerBlock",
  "showPaymentBlock",
  "showNotesBlock",
  "showSourceReference",
  "showVatSummary",
  "showStatusBadge",
  "showTermsBlock",
]);

export const TEMPLATE_SELLER_FIELD_TOGGLE_FIELDS = Object.freeze([
  "showSellerName",
  "showSellerAddress",
  "showSellerPostalCity",
  "showSellerCountry",
  "showSellerNip",
  "showSellerEmail",
  "showSellerPhone",
  "showSellerBank",
  "showSellerBankAccount",
  "showSellerWebsite",
]);

export const TEMPLATE_BUYER_FIELD_TOGGLE_FIELDS = Object.freeze([
  "showBuyerName",
  "showBuyerAddress",
  "showBuyerPostalCity",
  "showBuyerCountry",
  "showBuyerNip",
  "showBuyerEmail",
  "showBuyerPhone",
]);

export const TEMPLATE_TOGGLE_FIELDS = Object.freeze([
  ...TEMPLATE_BLOCK_TOGGLE_FIELDS,
  ...TEMPLATE_SELLER_FIELD_TOGGLE_FIELDS,
  ...TEMPLATE_BUYER_FIELD_TOGGLE_FIELDS,
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

export function normalizeDocumentType(type) {
  return String(type || "").trim().toUpperCase();
}

export function getTemplatePresetByKey(key) {
  const normalized = String(key || "").trim();
  return DOCUMENT_TEMPLATE_PRESETS[normalized] || null;
}

export function getTemplatePresetsForType(documentType) {
  const normalizedType = normalizeDocumentType(documentType);
  return Object.values(DOCUMENT_TEMPLATE_PRESETS).filter((preset) =>
    preset.allowedTypes.includes(normalizedType)
  );
}

export function resolveTemplatePresetForType(documentType, presetKey) {
  const normalizedType = normalizeDocumentType(documentType);
  const preset = getTemplatePresetByKey(presetKey);
  if (preset && preset.allowedTypes.includes(normalizedType)) {
    return preset.key;
  }
  return DEFAULT_TEMPLATE_PRESET_BY_TYPE[normalizedType] || DEFAULT_TEMPLATE_PRESET_BY_TYPE.QUOTE;
}

export function buildDefaultTemplateSetting(documentType) {
  const normalizedType = normalizeDocumentType(documentType);
  const safeType = DOCUMENT_TYPES.includes(normalizedType) ? normalizedType : "QUOTE";
  const templatePreset = resolveTemplatePresetForType(safeType, DEFAULT_TEMPLATE_PRESET_BY_TYPE[safeType]);
  const preset = getTemplatePresetByKey(templatePreset);
  const defaults = preset?.defaults || {};

  const booleanDefaults = TEMPLATE_TOGGLE_FIELDS.reduce((acc, fieldName) => {
    if (typeof defaults[fieldName] === "boolean") {
      acc[fieldName] = defaults[fieldName];
      return acc;
    }
    acc[fieldName] = TEMPLATE_BOOLEAN_DEFAULTS[fieldName];
    return acc;
  }, {});

  return {
    documentType: safeType,
    templatePreset,
    documentTitleOverride: "",
    layoutDensity: TEMPLATE_LAYOUT_DENSITIES.includes(defaults.layoutDensity)
      ? defaults.layoutDensity
      : "comfortable",
    sectionOrder: getTemplateSectionOrder(safeType, templatePreset),
    ...booleanDefaults,
  };
}

export function getTemplateSectionOrder(documentType, presetKey) {
  const resolved = resolveTemplatePresetForType(documentType, presetKey);
  const preset = getTemplatePresetByKey(resolved);
  const order = Array.isArray(preset?.sectionOrder) ? preset.sectionOrder : TEMPLATE_SECTION_KEYS;
  return order.filter((sectionKey) => TEMPLATE_SECTION_KEYS.includes(sectionKey));
}

function toCanonicalSectionKey(key) {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return "";
  if (TEMPLATE_SECTION_KEYS.includes(normalized)) return normalized;
  return TEMPLATE_SECTION_ALIASES[normalized] || "";
}

export function normalizeTemplateSectionOrder(sectionOrder, { documentType, presetKey } = {}) {
  const fallbackOrder = getTemplateSectionOrder(documentType, presetKey);
  const raw = Array.isArray(sectionOrder) ? sectionOrder : [];
  const seen = new Set();
  const normalized = [];

  raw.forEach((sectionKey) => {
    const canonical = toCanonicalSectionKey(sectionKey);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    normalized.push(canonical);
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

export function resolveTemplateSectionOrder(documentType, presetKey, sectionOrder) {
  const resolved = resolveTemplatePresetForType(documentType, presetKey);
  return normalizeTemplateSectionOrder(sectionOrder, {
    documentType,
    presetKey: resolved,
  });
}
