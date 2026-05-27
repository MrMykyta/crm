export const NUMBERING_CATEGORY_LABELS = Object.freeze({
  sales: "Продажи / коммерческие",
  warehouse: "Склад / логистика",
  finance: "Финансы / прочее",
});

export const DOCUMENT_NUMBERING_TYPE_ORDER = Object.freeze([
  "INVOICE",
  "INVOICE_CORRECTION",
  "PROFORMA",
  "ADVANCE_INVOICE",
  "ADVANCE_PROFORMA",
  "WDT_INVOICE",
  "QUOTE",
  "ORDER",
  "COMMERCIAL_PROPOSAL",
  "PZ",
  "WZ",
  "MM",
  "RW",
  "PW",
  "STOCK_ADJUSTMENT",
  "BILL",
  "RECEIPT",
  "CONTRACT",
]);

export const TEMPLATE_TOKEN_EXAMPLES = Object.freeze([
  "{YYYY}",
  "{YY}",
  "{MM}",
  "{DD}",
  "{SEQ}",
  "{SEQ:4}",
  "{TYPE}",
  "{COMPANY}",
  "{BRANCH}",
]);

export const PATTERN_EXAMPLES = Object.freeze([
  "FV/{YYYY}/{MM}/{SEQ:4}",
  "FVK/{YYYY}/{SEQ:4}",
  "PRO/{YYYY}/{MM}/{SEQ:4}",
  "WZ/{YYYY}/{MM}/{SEQ:5}",
  "{TYPE}/{YYYY}/{SEQ:4}",
  "DS/{TYPE}/{YY}/{MM}/{SEQ:4}",
]);

