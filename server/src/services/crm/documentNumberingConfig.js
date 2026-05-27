'use strict';

const DOCUMENT_TYPE_DEFINITIONS = Object.freeze({
  INVOICE: Object.freeze({
    documentType: 'INVOICE',
    label: 'Faktura VAT',
    category: 'sales',
    typeCode: 'FV',
    defaultPattern: 'FV/{YYYY}/{MM}/{SEQ:4}',
  }),
  INVOICE_CORRECTION: Object.freeze({
    documentType: 'INVOICE_CORRECTION',
    label: 'Faktura korygujaca',
    category: 'sales',
    typeCode: 'FVK',
    defaultPattern: 'FVK/{YYYY}/{MM}/{SEQ:4}',
  }),
  PROFORMA: Object.freeze({
    documentType: 'PROFORMA',
    label: 'Faktura proforma',
    category: 'sales',
    typeCode: 'PRO',
    defaultPattern: 'PRO/{YYYY}/{MM}/{SEQ:4}',
  }),
  ADVANCE_INVOICE: Object.freeze({
    documentType: 'ADVANCE_INVOICE',
    label: 'Faktura zaliczkowa',
    category: 'sales',
    typeCode: 'FZ',
    defaultPattern: 'FZ/{YYYY}/{MM}/{SEQ:4}',
  }),
  ADVANCE_PROFORMA: Object.freeze({
    documentType: 'ADVANCE_PROFORMA',
    label: 'Faktura zaliczkowa proforma',
    category: 'sales',
    typeCode: 'FZP',
    defaultPattern: 'FZP/{YYYY}/{MM}/{SEQ:4}',
  }),
  WDT_INVOICE: Object.freeze({
    documentType: 'WDT_INVOICE',
    label: 'Faktura WDT',
    category: 'sales',
    typeCode: 'WDT',
    defaultPattern: 'WDT/{YYYY}/{MM}/{SEQ:4}',
  }),
  QUOTE: Object.freeze({
    documentType: 'QUOTE',
    label: 'Oferta / Offer',
    category: 'sales',
    typeCode: 'OF',
    defaultPattern: 'OF/{YYYY}/{MM}/{SEQ:4}',
  }),
  ORDER: Object.freeze({
    documentType: 'ORDER',
    label: 'Zamowienie / Order',
    category: 'sales',
    typeCode: 'ZAM',
    defaultPattern: 'ZAM/{YYYY}/{MM}/{SEQ:4}',
  }),
  COMMERCIAL_PROPOSAL: Object.freeze({
    documentType: 'COMMERCIAL_PROPOSAL',
    label: 'Dokument handlowy',
    category: 'sales',
    typeCode: 'DS',
    defaultPattern: 'DS/{YYYY}/{MM}/{SEQ:4}',
  }),
  PZ: Object.freeze({
    documentType: 'PZ',
    label: 'PZ',
    category: 'warehouse',
    typeCode: 'PZ',
    defaultPattern: 'PZ/{YYYY}/{MM}/{SEQ:4}',
  }),
  WZ: Object.freeze({
    documentType: 'WZ',
    label: 'WZ',
    category: 'warehouse',
    typeCode: 'WZ',
    defaultPattern: 'WZ/{YYYY}/{MM}/{SEQ:4}',
  }),
  MM: Object.freeze({
    documentType: 'MM',
    label: 'MM',
    category: 'warehouse',
    typeCode: 'MM',
    defaultPattern: 'MM/{YYYY}/{MM}/{SEQ:4}',
  }),
  RW: Object.freeze({
    documentType: 'RW',
    label: 'RW',
    category: 'warehouse',
    typeCode: 'RW',
    defaultPattern: 'RW/{YYYY}/{MM}/{SEQ:4}',
  }),
  PW: Object.freeze({
    documentType: 'PW',
    label: 'PW',
    category: 'warehouse',
    typeCode: 'PW',
    defaultPattern: 'PW/{YYYY}/{MM}/{SEQ:4}',
  }),
  STOCK_ADJUSTMENT: Object.freeze({
    documentType: 'STOCK_ADJUSTMENT',
    label: 'Korekta magazynowa',
    category: 'warehouse',
    typeCode: 'INV',
    defaultPattern: 'INV/{YYYY}/{MM}/{SEQ:4}',
  }),
  BILL: Object.freeze({
    documentType: 'BILL',
    label: 'Rachunek / Schet',
    category: 'finance',
    typeCode: 'RACH',
    defaultPattern: 'RACH/{YYYY}/{MM}/{SEQ:4}',
  }),
  RECEIPT: Object.freeze({
    documentType: 'RECEIPT',
    label: 'Paragon / Receipt',
    category: 'finance',
    typeCode: 'PAR',
    defaultPattern: 'PAR/{YYYY}/{MM}/{SEQ:4}',
  }),
  CONTRACT: Object.freeze({
    documentType: 'CONTRACT',
    label: 'Umowa / Contract',
    category: 'finance',
    typeCode: 'CTR',
    defaultPattern: 'CTR/{YYYY}/{MM}/{SEQ:4}',
  }),
});

const DOCUMENT_TYPES = Object.freeze(Object.keys(DOCUMENT_TYPE_DEFINITIONS));
const RESET_POLICIES = Object.freeze(['none', 'yearly', 'monthly']);
const DEFAULT_RESET_POLICY = 'yearly';

const DOCUMENT_TYPE_ALIASES = Object.freeze({
  INVOICE_VAT: 'INVOICE',
  FACTURA: 'INVOICE',
  FACTURE: 'INVOICE',
  FAKTURA: 'INVOICE',
  FAKTURA_VAT: 'INVOICE',
  FAKTURA_KORYGUJACA: 'INVOICE_CORRECTION',
  CORRECTION_INVOICE: 'INVOICE_CORRECTION',
  PROFORMA_INVOICE: 'PROFORMA',
  ADVANCE: 'ADVANCE_INVOICE',
  ADVANCE_PROFORMA_INVOICE: 'ADVANCE_PROFORMA',
  WDT: 'WDT_INVOICE',
  OFFER: 'QUOTE',
  PROPOSAL: 'COMMERCIAL_PROPOSAL',
  PAYMENT_SLIP: 'BILL',
  KWIT: 'RECEIPT',
});

function normalizeDocumentType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (DOCUMENT_TYPE_DEFINITIONS[normalized]) return normalized;
  return DOCUMENT_TYPE_ALIASES[normalized] || normalized;
}

function normalizeResetPolicy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return DEFAULT_RESET_POLICY;
  if (normalized === 'never') return 'none';
  if (RESET_POLICIES.includes(normalized)) return normalized;
  return normalized;
}

function isDocumentType(value) {
  return DOCUMENT_TYPES.includes(normalizeDocumentType(value));
}

function getDocumentTypeMeta(documentType) {
  const normalizedType = normalizeDocumentType(documentType);
  return DOCUMENT_TYPE_DEFINITIONS[normalizedType] || null;
}

function buildDefaultSetting(documentType) {
  const normalizedType = normalizeDocumentType(documentType);
  const meta = getDocumentTypeMeta(normalizedType) || getDocumentTypeMeta('INVOICE');

  return {
    documentType: meta.documentType,
    label: meta.label,
    category: meta.category,
    typeCode: meta.typeCode,
    enabled: true,
    pattern: meta.defaultPattern,
    sequenceCounter: 0,
    lastNumber: null,
    resetPolicy: DEFAULT_RESET_POLICY,
  };
}

module.exports = {
  DOCUMENT_TYPES,
  RESET_POLICIES,
  DEFAULT_RESET_POLICY,
  DOCUMENT_TYPE_DEFINITIONS,
  normalizeDocumentType,
  normalizeResetPolicy,
  isDocumentType,
  getDocumentTypeMeta,
  buildDefaultSetting,
};
