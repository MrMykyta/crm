import { DOCUMENT_TYPES } from "./documentTypeConfig";

export const TEMPLATE_STATUSES = Object.freeze(["draft", "active", "archived"]);
export const TEMPLATE_PAGE_SIZES = Object.freeze(["A4"]);
export const TEMPLATE_PAGE_ORIENTATIONS = Object.freeze(["portrait", "landscape"]);
export const TEMPLATE_DENSITIES = Object.freeze(["compact", "comfortable"]);
export const TEMPLATE_PAGE_BEHAVIORS = Object.freeze([
  "first-page-only",
  "repeat-each-page",
  "last-page-only",
  "flow",
  "keep-together",
  "splittable",
]);
export const TEMPLATE_META_BEHAVIORS = Object.freeze([
  "hidden",
  "first-page-only",
  "repeat-each-page",
  "last-page-only",
]);
export const DOCUMENT_LANGUAGE_MODES = Object.freeze([
  "pl",
  "en",
  "de",
  "ua",
  "pl_en",
  "pl_de",
  "pl_ua",
]);

export const TEMPLATE_THEME_PRESETS = Object.freeze({
  classic_black: Object.freeze({
    key: "classic_black",
    label: "Klasyczny",
    themeConfig: Object.freeze({
      pageBackgroundColor: "#ffffff",
      primaryColor: "#15263a",
      textColor: "#1a2f46",
      borderColor: "#dbe3ec",
      subtleColor: "#6a829d",
      accentColor: "#0e2540",
    }),
  }),
  gray_corporate: Object.freeze({
    key: "gray_corporate",
    label: "Korporacyjny szary",
    themeConfig: Object.freeze({
      pageBackgroundColor: "#ffffff",
      primaryColor: "#3f4f63",
      textColor: "#2f3d4e",
      borderColor: "#cfd8e2",
      subtleColor: "#6b7787",
      accentColor: "#506175",
    }),
  }),
  blue_modern: Object.freeze({
    key: "blue_modern",
    label: "Nowoczesny niebieski",
    themeConfig: Object.freeze({
      pageBackgroundColor: "#ffffff",
      primaryColor: "#1f4f8a",
      textColor: "#1d3550",
      borderColor: "#cfe0f1",
      subtleColor: "#5d7996",
      accentColor: "#2563a3",
    }),
  }),
  green_invoice: Object.freeze({
    key: "green_invoice",
    label: "Fakturowy zielony",
    themeConfig: Object.freeze({
      pageBackgroundColor: "#ffffff",
      primaryColor: "#2f6f54",
      textColor: "#203a31",
      borderColor: "#d6e7df",
      subtleColor: "#638374",
      accentColor: "#327a5a",
    }),
  }),
});

export const TEMPLATE_LAYOUT_PRESETS = Object.freeze({
  classic_invoice: Object.freeze({
    key: "classic_invoice",
    label: "Faktura klasyczna",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "terms",
      "notes",
      "source_reference",
      "signatures",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "classic_black",
  }),
  minimal_invoice: Object.freeze({
    key: "minimal_invoice",
    label: "Faktura minimalna",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "watermark",
      "notes",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "gray_corporate",
  }),
  corporate_erp_invoice: Object.freeze({
    key: "corporate_erp_invoice",
    label: "Faktura korporacyjna / ERP",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "terms",
      "signatures",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "gray_corporate",
  }),
  service_rental_invoice: Object.freeze({
    key: "service_rental_invoice",
    label: "Faktura usługowa / wynajem",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "terms",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl_en",
    defaultThemePreset: "blue_modern",
  }),
  workshop_invoice: Object.freeze({
    key: "workshop_invoice",
    label: "Faktura warsztatowa",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "green_invoice",
  }),
  compact_invoice: Object.freeze({
    key: "compact_invoice",
    label: "Faktura kompaktowa",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "terms",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "classic_black",
  }),
  modern_invoice: Object.freeze({
    key: "modern_invoice",
    label: "Faktura nowoczesna",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "terms",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl_en",
    defaultThemePreset: "blue_modern",
  }),
  service_invoice: Object.freeze({
    key: "service_invoice",
    label: "Faktura serwisowa",
    allowedTypes: Object.freeze(["INVOICE", "BILL"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "terms",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl_en",
    defaultThemePreset: "blue_modern",
  }),
  quote_classic: Object.freeze({
    key: "quote_classic",
    label: "Oferta klasyczna",
    allowedTypes: Object.freeze(["QUOTE"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "terms",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "classic_black",
  }),
  quote_compact: Object.freeze({
    key: "quote_compact",
    label: "Oferta kompaktowa",
    allowedTypes: Object.freeze(["QUOTE"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "terms",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl_en",
    defaultThemePreset: "blue_modern",
  }),
  order_default: Object.freeze({
    key: "order_default",
    label: "Zamówienie domyślne",
    allowedTypes: Object.freeze(["ORDER"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "terms",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "classic_black",
  }),
  receipt_default: Object.freeze({
    key: "receipt_default",
    label: "Paragon domyślny",
    allowedTypes: Object.freeze(["RECEIPT"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "payment",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "gray_corporate",
  }),
  contract_default: Object.freeze({
    key: "contract_default",
    label: "Umowa domyślna",
    allowedTypes: Object.freeze(["CONTRACT"]),
    defaultSectionOrder: Object.freeze([
      "header",
      "seller_buyer",
      "items",
      "totals",
      "terms",
      "notes",
      "source_reference",
      "footer",
    ]),
    defaultDocumentLanguageMode: "pl",
    defaultThemePreset: "classic_black",
  }),
});

export const DEFAULT_LAYOUT_PRESET_BY_TYPE = Object.freeze({
  QUOTE: "quote_classic",
  ORDER: "order_default",
  INVOICE: "classic_invoice",
  BILL: "corporate_erp_invoice",
  RECEIPT: "receipt_default",
  CONTRACT: "contract_default",
});

export function normalizeDocumentLanguageMode(value, fallback = "pl") {
  const normalized = String(value || "").trim().toLowerCase();
  if (DOCUMENT_LANGUAGE_MODES.includes(normalized)) return normalized;
  return fallback;
}

function normalizeColorValue(value, fallback = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) return normalized;
  return fallback;
}

function normalizeOptionalNumber(value, min, max) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : parsed;
  const safeMax = Number.isFinite(Number(max)) ? Number(max) : parsed;
  return Math.max(safeMin, Math.min(safeMax, parsed));
}

function normalizeNumericSettingValue(value, fallback, min, max) {
  const raw = normalizeOptionalNumber(value, min, max);
  if (raw !== null) return raw;
  const fallbackValue = normalizeOptionalNumber(fallback, min, max);
  return fallbackValue !== null ? fallbackValue : "";
}

const NUMERIC_SETTING_LIMITS = Object.freeze({
  blockWidthPx: Object.freeze({ min: 140, max: 2000 }),
  blockMinHeightPx: Object.freeze({ min: 36, max: 1800 }),
  partiesSplitRatio: Object.freeze({ min: 25, max: 75 }),
  tableWidthPct: Object.freeze({ min: 40, max: 100 }),
  opacity: Object.freeze({ min: 0.02, max: 0.5 }),
  rowSplitPct: Object.freeze({ min: 20, max: 80 }),
});

const TEMPLATE_THEME_CONFIG_KEYS = Object.freeze([
  "pageBackgroundColor",
  "primaryColor",
  "textColor",
  "borderColor",
  "subtleColor",
  "accentColor",
]);

function normalizeThemePreset(value, fallback = "classic_black") {
  const normalized = String(value || "").trim();
  if (TEMPLATE_THEME_PRESETS[normalized]) return normalized;
  return fallback;
}

function normalizeThemeConfig(raw = {}, fallbackPreset = "classic_black") {
  const preset = TEMPLATE_THEME_PRESETS[normalizeThemePreset(fallbackPreset)];
  const fallback = preset?.themeConfig || TEMPLATE_THEME_PRESETS.classic_black.themeConfig;
  const safeRaw = raw && typeof raw === "object" ? raw : {};
  const normalized = {};
  TEMPLATE_THEME_CONFIG_KEYS.forEach((key) => {
    normalized[key] = normalizeColorValue(safeRaw[key], fallback[key]);
  });
  return normalized;
}

export const TEMPLATE_SECTION_CATALOG = Object.freeze({
  header: Object.freeze({
    key: "header",
    label: "Header",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: false,
    defaultEnabled: true,
    variants: Object.freeze(["meta_right", "centered", "erp_compact", "logo_meta_right"]),
    defaultVariant: "meta_right",
    defaultSettings: Object.freeze({
      pageBehavior: "first-page-only",
      repeatMetaOnEachPage: true,
      showTitle: true,
      showStatus: true,
      showDocumentNumber: true,
      showIssueDate: true,
      showSaleDate: true,
      showDeliveryDate: false,
      showOriginalCopyLabel: false,
      showCustomerNumber: false,
      titleZone: "top-left",
      numberZone: "top-left",
      issueDateZone: "meta-left",
      saleDateZone: "meta-left",
      deliveryDateZone: "meta-left",
      statusZone: "badges-area",
      directionZone: "top-right",
      originalCopyZone: "badges-area",
      customerNumberZone: "meta-right",
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
    }),
    allowedSettingKeys: Object.freeze([
      "pageBehavior",
      "repeatMetaOnEachPage",
      "showTitle",
      "showStatus",
      "showDocumentNumber",
      "showIssueDate",
      "showSaleDate",
      "showDeliveryDate",
      "showOriginalCopyLabel",
      "showCustomerNumber",
      "titleZone",
      "numberZone",
      "issueDateZone",
      "saleDateZone",
      "deliveryDateZone",
      "statusZone",
      "directionZone",
      "originalCopyZone",
      "customerNumberZone",
      "blockWidthPx",
      "blockAlign",
      "blockMinHeightPx",
      "textColor",
      "accentColor",
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "padding",
      "borderRadius",
    ]),
  }),
  seller_buyer: Object.freeze({
    key: "seller_buyer",
    label: "Parties",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: true,
    defaultEnabled: true,
    variants: Object.freeze([
      "two-column",
      "seller_left_buyer_right",
      "seller_right_buyer_below",
      "seller_buyer_receiver",
      "compact",
      "stacked",
    ]),
    defaultVariant: "two-column",
    defaultSettings: Object.freeze({
      pageBehavior: "keep-together",
      layoutVariant: "two-column",
      showSellerTitle: true,
      showBuyerTitle: true,
      showReceiverTitle: false,
      showPayerTitle: false,
      partiesSplitRatio: 50,
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
      rowGroupId: "",
      rowSlot: "",
      rowSplitPct: "",
    }),
    allowedSettingKeys: Object.freeze([
      "pageBehavior",
      "layoutVariant",
      "showSellerTitle",
      "showBuyerTitle",
      "showReceiverTitle",
      "showPayerTitle",
      "partiesSplitRatio",
      "blockWidthPx",
      "blockAlign",
      "blockMinHeightPx",
      "textColor",
      "accentColor",
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "padding",
      "borderRadius",
      "rowGroupId",
      "rowSlot",
      "rowSplitPct",
    ]),
  }),
  items: Object.freeze({
    key: "items",
    label: "Items table",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: false,
    defaultEnabled: true,
    variants: Object.freeze(["standard", "minimal", "erp_gray", "service_rental"]),
    defaultVariant: "standard",
    defaultSettings: Object.freeze({
      pageBehavior: "splittable",
      repeatTableHeaderOnSplit: true,
      tablePreset: "standard",
      compactRows: false,
      showSku: false,
      showVat: true,
      showUnit: true,
      showDescription: false,
      showAdditionalQty: false,
      showDiscount: false,
      showVatValue: false,
      showPeriod: false,
      tableWidthPct: 100,
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
    }),
    allowedSettingKeys: Object.freeze([
      "pageBehavior",
      "repeatTableHeaderOnSplit",
      "tablePreset",
      "compactRows",
      "showSku",
      "showVat",
      "showUnit",
      "showDescription",
      "showAdditionalQty",
      "showDiscount",
      "showVatValue",
      "showPeriod",
      "tableWidthPct",
      "blockWidthPx",
      "blockAlign",
      "blockMinHeightPx",
      "textColor",
      "accentColor",
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "padding",
      "borderRadius",
    ]),
  }),
  totals: Object.freeze({
    key: "totals",
    label: "Totals",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: true,
    defaultEnabled: true,
    variants: Object.freeze(["summary_box", "bottom_rows", "due_focus", "vat_breakdown"]),
    defaultVariant: "summary_box",
    defaultSettings: Object.freeze({
      pageBehavior: "keep-together",
      highlightGross: true,
      showVatSummary: true,
      showAmountDue: true,
      showAmountInWords: false,
      showVatBreakdown: false,
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
      rowGroupId: "",
      rowSlot: "",
      rowSplitPct: "",
    }),
    allowedSettingKeys: Object.freeze([
      "pageBehavior",
      "highlightGross",
      "showVatSummary",
      "showAmountDue",
      "showAmountInWords",
      "showVatBreakdown",
      "blockWidthPx",
      "blockAlign",
      "blockMinHeightPx",
      "textColor",
      "accentColor",
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "padding",
      "borderRadius",
      "rowGroupId",
      "rowSlot",
      "rowSplitPct",
    ]),
  }),
  payment: Object.freeze({
    key: "payment",
    label: "Payment",
    supportedTypes: Object.freeze(["INVOICE", "BILL", "RECEIPT"]),
    reorderable: true,
    disableable: true,
    defaultEnabled: true,
    variants: Object.freeze(["compact", "detailed", "bank_focus"]),
    defaultVariant: "compact",
    defaultSettings: Object.freeze({
      pageBehavior: "keep-together",
      mode: "compact",
      showBankDetails: true,
      showPaidRemaining: true,
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
      rowGroupId: "",
      rowSlot: "",
      rowSplitPct: "",
    }),
    allowedSettingKeys: Object.freeze([
      "pageBehavior",
      "mode",
      "showBankDetails",
      "showPaidRemaining",
      "blockWidthPx",
      "blockAlign",
      "blockMinHeightPx",
      "textColor",
      "accentColor",
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "padding",
      "borderRadius",
      "rowGroupId",
      "rowSlot",
      "rowSplitPct",
    ]),
  }),
  terms: Object.freeze({
    key: "terms",
    label: "Terms",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: true,
    defaultEnabled: true,
    variants: Object.freeze(["default"]),
    defaultVariant: "default",
    defaultSettings: Object.freeze({
      pageBehavior: "keep-together",
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
      rowGroupId: "",
      rowSlot: "",
      rowSplitPct: "",
    }),
    allowedSettingKeys: Object.freeze(["pageBehavior", "blockWidthPx", "blockAlign", "blockMinHeightPx", "textColor", "accentColor", "backgroundColor", "borderColor", "borderWidth", "padding", "borderRadius", "rowGroupId", "rowSlot", "rowSplitPct"]),
  }),
  notes: Object.freeze({
    key: "notes",
    label: "Notes",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: true,
    defaultEnabled: true,
    variants: Object.freeze(["default"]),
    defaultVariant: "default",
    defaultSettings: Object.freeze({
      pageBehavior: "flow",
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
      rowGroupId: "",
      rowSlot: "",
      rowSplitPct: "",
    }),
    allowedSettingKeys: Object.freeze(["pageBehavior", "blockWidthPx", "blockAlign", "blockMinHeightPx", "textColor", "accentColor", "backgroundColor", "borderColor", "borderWidth", "padding", "borderRadius", "rowGroupId", "rowSlot", "rowSplitPct"]),
  }),
  source_reference: Object.freeze({
    key: "source_reference",
    label: "Source reference",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: true,
    defaultEnabled: false,
    variants: Object.freeze(["default"]),
    defaultVariant: "default",
    defaultSettings: Object.freeze({
      pageBehavior: "keep-together",
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
      rowGroupId: "",
      rowSlot: "",
      rowSplitPct: "",
    }),
    allowedSettingKeys: Object.freeze(["pageBehavior", "blockWidthPx", "blockAlign", "blockMinHeightPx", "textColor", "accentColor", "backgroundColor", "borderColor", "borderWidth", "padding", "borderRadius", "rowGroupId", "rowSlot", "rowSplitPct"]),
  }),
  signatures: Object.freeze({
    key: "signatures",
    label: "Signatures",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: true,
    defaultEnabled: false,
    variants: Object.freeze(["issuer_receiver", "three_signatures"]),
    defaultVariant: "issuer_receiver",
    defaultSettings: Object.freeze({
      pageBehavior: "last-page-only",
      showIssuerSignature: true,
      showReceiverSignature: true,
      showPayerSignature: false,
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
      rowGroupId: "",
      rowSlot: "",
      rowSplitPct: "",
    }),
    allowedSettingKeys: Object.freeze([
      "pageBehavior",
      "showIssuerSignature",
      "showReceiverSignature",
      "showPayerSignature",
      "blockWidthPx",
      "blockAlign",
      "blockMinHeightPx",
      "textColor",
      "accentColor",
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "padding",
      "borderRadius",
      "rowGroupId",
      "rowSlot",
      "rowSplitPct",
    ]),
  }),
  footer: Object.freeze({
    key: "footer",
    label: "Footer",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: true,
    defaultEnabled: false,
    variants: Object.freeze(["basic", "contacts", "marketing"]),
    defaultVariant: "basic",
    defaultSettings: Object.freeze({
      pageBehavior: "last-page-only",
      alignment: "left",
      showPageNumber: false,
      showGeneratedBy: true,
      pageNumberPosition: "footer-right",
      generatedByPosition: "footer-left",
      pageNumberFormat: "localized-total",
      footerContentBehavior: "last-page-only",
      footerMetaBehavior: "repeat-each-page",
      pageNumberBehavior: "repeat-each-page",
      generatedByBehavior: "last-page-only",
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
      rowGroupId: "",
      rowSlot: "",
      rowSplitPct: "",
    }),
    allowedSettingKeys: Object.freeze([
      "pageBehavior",
      "alignment",
      "showPageNumber",
      "showGeneratedBy",
      "pageNumberPosition",
      "generatedByPosition",
      "pageNumberFormat",
      "footerContentBehavior",
      "footerMetaBehavior",
      "pageNumberBehavior",
      "generatedByBehavior",
      "blockWidthPx",
      "blockAlign",
      "blockMinHeightPx",
      "textColor",
      "accentColor",
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "padding",
      "borderRadius",
      "rowGroupId",
      "rowSlot",
      "rowSplitPct",
    ]),
  }),
  watermark: Object.freeze({
    key: "watermark",
    label: "Watermark",
    supportedTypes: Object.freeze([...DOCUMENT_TYPES]),
    reorderable: true,
    disableable: true,
    defaultEnabled: false,
    variants: Object.freeze(["paid_stamp", "custom"]),
    defaultVariant: "paid_stamp",
    defaultSettings: Object.freeze({
      pageBehavior: "repeat-each-page",
      mode: "auto",
      text: "",
      opacity: "0.12",
      blockWidthPx: "",
      blockAlign: "",
      blockMinHeightPx: "",
      textColor: "",
      accentColor: "",
      backgroundColor: "",
      borderColor: "",
      borderWidth: "",
      padding: "",
      borderRadius: "",
    }),
    allowedSettingKeys: Object.freeze([
      "pageBehavior",
      "mode",
      "text",
      "opacity",
      "blockWidthPx",
      "blockAlign",
      "blockMinHeightPx",
      "textColor",
      "accentColor",
      "backgroundColor",
      "borderColor",
      "borderWidth",
      "padding",
      "borderRadius",
    ]),
  }),
});

export const TEMPLATE_FIELD_CATALOG = Object.freeze({
  "document.typeLabel": { key: "document.typeLabel", sectionKey: "header", label: "Тип документа" },
  "document.number": { key: "document.number", sectionKey: "header", label: "Номер документа" },
  "document.issueDate": { key: "document.issueDate", sectionKey: "header", label: "Дата документа" },
  "document.saleDate": { key: "document.saleDate", sectionKey: "header", label: "Дата продажи" },
  "document.deliveryDate": { key: "document.deliveryDate", sectionKey: "header", label: "Дата поставки" },
  "document.status": { key: "document.status", sectionKey: "header", label: "Статус документа" },
  "document.direction": { key: "document.direction", sectionKey: "header", label: "Направление" },
  "document.originalCopyLabel": {
    key: "document.originalCopyLabel",
    sectionKey: "header",
    label: "Оригинал / Копия",
  },
  "document.customerNumber": { key: "document.customerNumber", sectionKey: "header", label: "Номер клиента" },

  "company.name": { key: "company.name", sectionKey: "seller_buyer", label: "Продавец: название" },
  "company.address": { key: "company.address", sectionKey: "seller_buyer", label: "Продавец: адрес" },
  "company.postalCode": { key: "company.postalCode", sectionKey: "seller_buyer", label: "Продавец: индекс" },
  "company.city": { key: "company.city", sectionKey: "seller_buyer", label: "Продавец: город" },
  "company.country": { key: "company.country", sectionKey: "seller_buyer", label: "Продавец: страна" },
  "company.nip": { key: "company.nip", sectionKey: "seller_buyer", label: "Продавец: NIP/VAT ID" },
  "company.bdo": { key: "company.bdo", sectionKey: "seller_buyer", label: "Продавец: BDO" },
  "company.email": { key: "company.email", sectionKey: "seller_buyer", label: "Продавец: email" },
  "company.phone": { key: "company.phone", sectionKey: "seller_buyer", label: "Продавец: телефон" },
  "company.bank": { key: "company.bank", sectionKey: "seller_buyer", label: "Продавец: банк" },
  "company.bankAccount": { key: "company.bankAccount", sectionKey: "seller_buyer", label: "Продавец: счёт" },
  "company.website": { key: "company.website", sectionKey: "seller_buyer", label: "Продавец: сайт" },

  "buyer.name": { key: "buyer.name", sectionKey: "seller_buyer", label: "Покупатель: название" },
  "buyer.address": { key: "buyer.address", sectionKey: "seller_buyer", label: "Покупатель: адрес" },
  "buyer.postalCode": { key: "buyer.postalCode", sectionKey: "seller_buyer", label: "Покупатель: индекс" },
  "buyer.city": { key: "buyer.city", sectionKey: "seller_buyer", label: "Покупатель: город" },
  "buyer.country": { key: "buyer.country", sectionKey: "seller_buyer", label: "Покупатель: страна" },
  "buyer.nip": { key: "buyer.nip", sectionKey: "seller_buyer", label: "Покупатель: NIP/VAT ID" },
  "buyer.email": { key: "buyer.email", sectionKey: "seller_buyer", label: "Покупатель: email" },
  "buyer.phone": { key: "buyer.phone", sectionKey: "seller_buyer", label: "Покупатель: телефон" },
  "receiver.name": { key: "receiver.name", sectionKey: "seller_buyer", label: "Получатель: название" },
  "receiver.address": { key: "receiver.address", sectionKey: "seller_buyer", label: "Получатель: адрес" },
  "payer.name": { key: "payer.name", sectionKey: "seller_buyer", label: "Плательщик: название" },
  "document.contactPerson": {
    key: "document.contactPerson",
    sectionKey: "seller_buyer",
    label: "Контактное лицо",
  },

  "item.lp": { key: "item.lp", sectionKey: "items", label: "LP" },
  "item.name": { key: "item.name", sectionKey: "items", label: "Наименование" },
  "item.description": { key: "item.description", sectionKey: "items", label: "Описание" },
  "item.sku": { key: "item.sku", sectionKey: "items", label: "SKU" },
  "item.pkwiu": { key: "item.pkwiu", sectionKey: "items", label: "PKWiU / CN" },
  "item.quantity": { key: "item.quantity", sectionKey: "items", label: "Количество" },
  "item.unit": { key: "item.unit", sectionKey: "items", label: "Ед." },
  "item.additionalQuantity": { key: "item.additionalQuantity", sectionKey: "items", label: "Доп. кол-во" },
  "item.additionalUnit": { key: "item.additionalUnit", sectionKey: "items", label: "Доп. ед." },
  "item.unitNet": { key: "item.unitNet", sectionKey: "items", label: "Цена без НДС" },
  "item.unitGross": { key: "item.unitGross", sectionKey: "items", label: "Цена с НДС" },
  "item.discount": { key: "item.discount", sectionKey: "items", label: "Скидка %" },
  "item.vatRate": { key: "item.vatRate", sectionKey: "items", label: "НДС %" },
  "item.vatValue": { key: "item.vatValue", sectionKey: "items", label: "Сумма НДС" },
  "item.sumNet": { key: "item.sumNet", sectionKey: "items", label: "Сумма без НДС" },
  "item.sumGross": { key: "item.sumGross", sectionKey: "items", label: "Сумма с НДС" },
  "item.rentalPeriod": { key: "item.rentalPeriod", sectionKey: "items", label: "Период услуги/аренды" },

  "totals.net": { key: "totals.net", sectionKey: "totals", label: "Итого без НДС" },
  "totals.vat": { key: "totals.vat", sectionKey: "totals", label: "Итого НДС" },
  "totals.gross": { key: "totals.gross", sectionKey: "totals", label: "Итого с НДС" },
  "totals.amountDue": { key: "totals.amountDue", sectionKey: "totals", label: "К оплате" },
  "totals.paidAmount": { key: "totals.paidAmount", sectionKey: "totals", label: "Оплачено" },
  "totals.remainingAmount": { key: "totals.remainingAmount", sectionKey: "totals", label: "Осталось" },
  "totals.amountInWords": { key: "totals.amountInWords", sectionKey: "totals", label: "Сумма прописью" },
  "totals.vatBreakdown": { key: "totals.vatBreakdown", sectionKey: "totals", label: "Разбивка VAT" },

  "payment.status": { key: "payment.status", sectionKey: "payment", label: "Статус оплаты" },
  "payment.paidAmount": { key: "payment.paidAmount", sectionKey: "payment", label: "Оплачено" },
  "payment.remainingAmount": { key: "payment.remainingAmount", sectionKey: "payment", label: "Осталось" },
  "payment.paymentDate": { key: "payment.paymentDate", sectionKey: "payment", label: "Дата оплаты" },
  "payment.paymentMethod": { key: "payment.paymentMethod", sectionKey: "payment", label: "Метод оплаты" },
  "payment.paymentDueDate": { key: "payment.paymentDueDate", sectionKey: "payment", label: "Оплатить до" },
  "payment.bank": { key: "payment.bank", sectionKey: "payment", label: "Банк" },
  "payment.bankAccount": { key: "payment.bankAccount", sectionKey: "payment", label: "Счёт" },

  "terms.validFrom": { key: "terms.validFrom", sectionKey: "terms", label: "Действует с" },
  "terms.validTo": { key: "terms.validTo", sectionKey: "terms", label: "Действует до" },
  "terms.validDays": { key: "terms.validDays", sectionKey: "terms", label: "Срок действия (дни)" },
  "terms.paymentDays": { key: "terms.paymentDays", sectionKey: "terms", label: "Срок оплаты (дни)" },
  "terms.text": { key: "terms.text", sectionKey: "terms", label: "Текст условий" },

  "document.notes": { key: "document.notes", sectionKey: "notes", label: "Примечание документа" },
  "document.internalNotes": { key: "document.internalNotes", sectionKey: "notes", label: "Внутреннее примечание" },
  "source.reference": { key: "source.reference", sectionKey: "source_reference", label: "Ссылка на источник" },

  "signature.issuer": { key: "signature.issuer", sectionKey: "signatures", label: "Подпись выдал" },
  "signature.receiver": { key: "signature.receiver", sectionKey: "signatures", label: "Подпись получил" },
  "signature.payer": { key: "signature.payer", sectionKey: "signatures", label: "Подпись плательщика" },

  "footer.generatedBy": { key: "footer.generatedBy", sectionKey: "footer", label: "Сгенерировано" },
  "footer.contacts": { key: "footer.contacts", sectionKey: "footer", label: "Контакты компании" },
  "footer.marketing": { key: "footer.marketing", sectionKey: "footer", label: "Маркетинговый футер" },
  "footer.pageNumber": { key: "footer.pageNumber", sectionKey: "footer", label: "Номер страницы" },

  "watermark.paidLabel": { key: "watermark.paidLabel", sectionKey: "watermark", label: "Watermark оплаты" },
});

export const DEFAULT_FIELDS_BY_SECTION = Object.freeze({
  header: Object.freeze([
    "document.typeLabel",
    "document.number",
    "document.issueDate",
    "document.saleDate",
    "document.status",
    "document.direction",
    "document.originalCopyLabel",
  ]),
  seller_buyer: Object.freeze([
    "company.name",
    "company.address",
    "company.postalCode",
    "company.city",
    "company.country",
    "company.nip",
    "company.bdo",
    "company.email",
    "company.phone",
    "company.bank",
    "company.bankAccount",
    "company.website",
    "buyer.name",
    "buyer.address",
    "buyer.postalCode",
    "buyer.city",
    "buyer.country",
    "buyer.nip",
    "buyer.email",
    "buyer.phone",
    "receiver.name",
    "payer.name",
    "document.contactPerson",
  ]),
  items: Object.freeze([
    "item.lp",
    "item.name",
    "item.description",
    "item.quantity",
    "item.unit",
    "item.additionalQuantity",
    "item.additionalUnit",
    "item.unitNet",
    "item.discount",
    "item.vatRate",
    "item.vatValue",
    "item.sumNet",
    "item.sumGross",
    "item.rentalPeriod",
  ]),
  totals: Object.freeze([
    "totals.net",
    "totals.vat",
    "totals.gross",
    "totals.amountDue",
    "totals.paidAmount",
    "totals.remainingAmount",
    "totals.amountInWords",
  ]),
  payment: Object.freeze([
    "payment.status",
    "payment.paidAmount",
    "payment.remainingAmount",
    "payment.paymentDate",
    "payment.paymentMethod",
    "payment.paymentDueDate",
    "payment.bank",
    "payment.bankAccount",
  ]),
  terms: Object.freeze([
    "terms.validFrom",
    "terms.validTo",
    "terms.validDays",
    "terms.paymentDays",
    "terms.text",
  ]),
  notes: Object.freeze(["document.notes", "document.internalNotes"]),
  source_reference: Object.freeze(["source.reference"]),
  signatures: Object.freeze(["signature.issuer", "signature.receiver"]),
  footer: Object.freeze(["footer.generatedBy", "footer.contacts", "footer.pageNumber"]),
  watermark: Object.freeze(["watermark.paidLabel"]),
});

export function resolveLayoutPresetForType(documentType, layoutPreset) {
  const normalizedType = String(documentType || "").trim().toUpperCase();
  const preset = TEMPLATE_LAYOUT_PRESETS[String(layoutPreset || "").trim()];
  if (preset && preset.allowedTypes.includes(normalizedType)) return preset.key;
  return DEFAULT_LAYOUT_PRESET_BY_TYPE[normalizedType] || DEFAULT_LAYOUT_PRESET_BY_TYPE.QUOTE;
}

export function listSectionsForType(documentType) {
  const normalizedType = String(documentType || "").trim().toUpperCase();
  return Object.values(TEMPLATE_SECTION_CATALOG).filter((section) => section.supportedTypes.includes(normalizedType));
}

export function listFieldsForSection(sectionKey, documentType) {
  const section = TEMPLATE_SECTION_CATALOG[sectionKey];
  const normalizedType = String(documentType || "").trim().toUpperCase();
  if (!section || !section.supportedTypes.includes(normalizedType)) return [];
  return Object.values(TEMPLATE_FIELD_CATALOG).filter((field) => field.sectionKey === sectionKey);
}

function getPresetSectionOverrides(presetKey = "") {
  const key = String(presetKey || "").trim();
  const shared = {
    header: { enabled: true },
    seller_buyer: { enabled: true },
    items: { enabled: true },
    totals: { enabled: true },
  };
  if (key === "classic_invoice") {
    return {
      ...shared,
      header: { variant: "meta_right", settings: { showStatus: true, showSaleDate: true } },
      seller_buyer: { variant: "two-column", settings: { showSellerTitle: true, showBuyerTitle: true } },
      items: { variant: "standard", settings: { showVat: true, showUnit: true } },
      totals: { variant: "summary_box", settings: { showVatSummary: true, showAmountDue: true } },
      payment: { variant: "detailed", enabled: true, settings: { showBankDetails: true } },
      terms: { enabled: true },
      signatures: { enabled: true, variant: "issuer_receiver" },
      footer: { variant: "contacts", enabled: true },
      watermark: { enabled: false },
      source_reference: { enabled: false },
    };
  }
  if (key === "minimal_invoice") {
    return {
      ...shared,
      header: { variant: "centered", settings: { showStatus: false, showDeliveryDate: false } },
      seller_buyer: { variant: "compact", settings: { showReceiverTitle: false, showPayerTitle: false } },
      items: { variant: "minimal", settings: { compactRows: true, showVatValue: false, showDescription: false } },
      totals: { variant: "due_focus", settings: { showAmountInWords: true, showVatBreakdown: false } },
      watermark: { enabled: true, variant: "paid_stamp", settings: { mode: "auto", text: "" } },
      payment: { variant: "compact", enabled: true, settings: { showBankDetails: false } },
      signatures: { enabled: false },
      source_reference: { enabled: false },
      notes: { enabled: false },
      footer: { variant: "basic", enabled: true },
    };
  }
  if (key === "corporate_erp_invoice") {
    return {
      ...shared,
      header: { variant: "erp_compact", settings: { showCustomerNumber: true, showOriginalCopyLabel: true } },
      seller_buyer: { variant: "seller_left_buyer_right" },
      items: { variant: "erp_gray", settings: { showSku: true, showDescription: true, showVatValue: true } },
      totals: { variant: "vat_breakdown", settings: { showVatBreakdown: true, showAmountDue: true } },
      payment: { variant: "detailed", settings: { showBankDetails: true, showPaidRemaining: true } },
      signatures: { enabled: true, variant: "three_signatures", settings: { showPayerSignature: true } },
      footer: { variant: "contacts", enabled: true },
      source_reference: { enabled: true },
    };
  }
  if (key === "service_rental_invoice") {
    return {
      ...shared,
      header: { variant: "logo_meta_right" },
      seller_buyer: { variant: "seller_buyer_receiver", settings: { showReceiverTitle: true } },
      items: {
        variant: "service_rental",
        settings: {
          showDescription: true,
          showAdditionalQty: true,
          showDiscount: true,
          showVatValue: true,
          showPeriod: true,
        },
      },
      totals: { variant: "summary_box", settings: { showAmountDue: true } },
      payment: { variant: "bank_focus", settings: { showBankDetails: true } },
      terms: { enabled: true },
      notes: { enabled: true },
      source_reference: { enabled: true },
      footer: { variant: "contacts", enabled: true },
    };
  }
  if (key === "workshop_invoice") {
    return {
      ...shared,
      header: { variant: "meta_right", settings: { showSaleDate: true, showCustomerNumber: true } },
      seller_buyer: { variant: "compact", settings: { showBuyerTitle: true } },
      items: { variant: "service_rental", settings: { showDescription: true, showPeriod: true, compactRows: true } },
      totals: { variant: "due_focus", settings: { showAmountDue: true } },
      payment: { variant: "compact", enabled: true },
      signatures: { enabled: true, variant: "issuer_receiver" },
      source_reference: { enabled: true },
      footer: { variant: "contacts", enabled: true },
    };
  }
  return {
    ...shared,
    header: { variant: "meta_right" },
    seller_buyer: { variant: "two-column" },
    items: { variant: "standard" },
    totals: { variant: "summary_box" },
    payment: { variant: "detailed", enabled: true },
    terms: { enabled: true },
    footer: { variant: "basic", enabled: true },
  };
}

export function buildDefaultTemplateSchema(documentType, layoutPreset) {
  const normalizedType = String(documentType || "").trim().toUpperCase();
  const resolvedPreset = resolveLayoutPresetForType(normalizedType, layoutPreset);
  const preset = TEMPLATE_LAYOUT_PRESETS[resolvedPreset];
  const presetSectionOverrides = getPresetSectionOverrides(resolvedPreset);
  const sectionsByType = listSectionsForType(normalizedType);
  const orderBase = Array.isArray(preset?.defaultSectionOrder) ? preset.defaultSectionOrder : [];
  const sortedKeys = [...orderBase, ...sectionsByType.map((section) => section.key)].filter(
    (key, idx, arr) => arr.indexOf(key) === idx
  );

  return {
    documentLanguageMode: normalizeDocumentLanguageMode(
      preset?.defaultDocumentLanguageMode || "pl",
      "pl"
    ),
    themePreset: normalizeThemePreset(preset?.defaultThemePreset, "classic_black"),
    themeConfig: normalizeThemeConfig(
      preset?.defaultThemeConfig || {},
      normalizeThemePreset(preset?.defaultThemePreset, "classic_black")
    ),
    sections: sortedKeys
      .map((sectionKey, index) => {
        const sectionDef = TEMPLATE_SECTION_CATALOG[sectionKey];
        if (!sectionDef || !sectionDef.supportedTypes.includes(normalizedType)) return null;
        const availableFieldKeys = listFieldsForSection(sectionKey, normalizedType).map((field) => field.key);
        const defaultFieldKeys = (DEFAULT_FIELDS_BY_SECTION[sectionKey] || []).filter((fieldKey) =>
          availableFieldKeys.includes(fieldKey)
        );
        const override = presetSectionOverrides[sectionDef.key] || {};
        return {
          key: sectionDef.key,
          enabled:
            typeof override.enabled === "boolean" ? override.enabled : Boolean(sectionDef.defaultEnabled),
          order: index,
          variant:
            sectionDef.variants.includes(override.variant) ? override.variant : sectionDef.defaultVariant || "default",
          settings: {
            ...(sectionDef.defaultSettings || {}),
            ...(override.settings && typeof override.settings === "object" ? override.settings : {}),
          },
          fields: defaultFieldKeys.map((fieldKey, fieldIndex) => ({
            key: fieldKey,
            enabled: true,
            order: fieldIndex,
          })),
        };
      })
      .filter(Boolean),
  };
}

export function normalizeTemplateSchema(schema, { documentType, layoutPreset } = {}) {
  const normalizedType = String(documentType || "").trim().toUpperCase();
  const fallback = buildDefaultTemplateSchema(normalizedType, layoutPreset);
  const rawSections = Array.isArray(schema?.sections) ? schema.sections : [];
  const byKey = new Map();

  rawSections.forEach((section) => {
    const sectionKey = String(section?.key || "").trim();
    const sectionDef = TEMPLATE_SECTION_CATALOG[sectionKey];
    if (!sectionDef || !sectionDef.supportedTypes.includes(normalizedType)) return;
    if (byKey.has(sectionKey)) return;

    const availableFieldKeys = listFieldsForSection(sectionKey, normalizedType).map((field) => field.key);
    const rawFields = Array.isArray(section?.fields) ? section.fields : [];
    const seenFieldKeys = new Set();
    const fields = [];

    rawFields.forEach((field, fieldIndex) => {
      const fieldKey = String(field?.key || "").trim();
      if (!fieldKey || seenFieldKeys.has(fieldKey) || !availableFieldKeys.includes(fieldKey)) return;
      seenFieldKeys.add(fieldKey);
      fields.push({
        key: fieldKey,
        enabled: typeof field?.enabled === "boolean" ? field.enabled : true,
        order: Number.isFinite(Number(field?.order)) ? Number(field.order) : fieldIndex,
        textColor: normalizeColorValue(field?.textColor, ""),
        accentColor: normalizeColorValue(field?.accentColor, ""),
        widthPct: normalizeOptionalNumber(field?.widthPct, 6, 70),
      });
    });

    const fallbackFields = fallback.sections.find((item) => item.key === sectionKey)?.fields || [];
    fallbackFields.forEach((field) => {
      if (seenFieldKeys.has(field.key)) return;
      seenFieldKeys.add(field.key);
      fields.push({ ...field });
    });

    fields.sort((a, b) => Number(a.order) - Number(b.order));
    fields.forEach((field, index) => {
      field.order = index;
    });

    const rawSettings = section?.settings && typeof section.settings === "object" ? section.settings : {};
    const settings = {};
    (sectionDef.allowedSettingKeys || []).forEach((settingKey) => {
      const fallbackValue = sectionDef.defaultSettings?.[settingKey];
      const rawValue = Object.prototype.hasOwnProperty.call(rawSettings, settingKey)
        ? rawSettings[settingKey]
        : fallbackValue;
      if (typeof fallbackValue === "boolean") {
        settings[settingKey] = Boolean(rawValue);
      } else if (NUMERIC_SETTING_LIMITS[settingKey]) {
        const limits = NUMERIC_SETTING_LIMITS[settingKey];
        settings[settingKey] = normalizeNumericSettingValue(rawValue, fallbackValue, limits.min, limits.max);
      } else if (settingKey === "textColor" || settingKey === "accentColor") {
        settings[settingKey] = normalizeColorValue(rawValue, normalizeColorValue(fallbackValue, ""));
      } else {
        settings[settingKey] = String(rawValue || fallbackValue || "").trim() || fallbackValue;
      }
    });

    byKey.set(sectionKey, {
      key: sectionDef.key,
      enabled: sectionDef.disableable ? Boolean(section?.enabled ?? sectionDef.defaultEnabled) : true,
      order: Number.isFinite(Number(section?.order)) ? Number(section.order) : Number.MAX_SAFE_INTEGER,
      variant: sectionDef.variants.includes(section?.variant) ? section.variant : sectionDef.defaultVariant || "default",
      settings,
      fields,
    });
  });

  fallback.sections.forEach((section, fallbackIndex) => {
    if (byKey.has(section.key)) return;
    byKey.set(section.key, {
      ...section,
      order: fallbackIndex + 1000,
    });
  });

  const sections = Array.from(byKey.values())
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((section, index) => ({
      ...section,
      order: index,
    }));

  const documentLanguageMode = normalizeDocumentLanguageMode(
    schema?.documentLanguageMode,
    fallback.documentLanguageMode
  );
  const themePreset = normalizeThemePreset(schema?.themePreset, fallback.themePreset);
  const themeConfig = normalizeThemeConfig(schema?.themeConfig, themePreset);

  return { documentLanguageMode, themePreset, themeConfig, sections };
}

export function buildDefaultTemplate(documentType, overrides = {}) {
  const normalizedType = String(documentType || "").trim().toUpperCase();
  const layoutPreset = resolveLayoutPresetForType(normalizedType, overrides.layoutPreset);
  return {
    id: null,
    name: overrides.name || `${normalizedType} Template`,
    documentType: normalizedType,
    isDefault: Boolean(overrides.isDefault),
    status: overrides.status || "active",
    pageSize: TEMPLATE_PAGE_SIZES.includes(overrides.pageSize) ? overrides.pageSize : "A4",
    pageOrientation: TEMPLATE_PAGE_ORIENTATIONS.includes(overrides.pageOrientation)
      ? overrides.pageOrientation
      : "portrait",
    density: TEMPLATE_DENSITIES.includes(overrides.density) ? overrides.density : "comfortable",
    layoutPreset,
    titleOverride: String(overrides.titleOverride || "").trim(),
    schema: normalizeTemplateSchema(overrides.schema, { documentType: normalizedType, layoutPreset }),
  };
}

export function normalizeDocumentTemplateRow(row = {}) {
  const documentType = String(row.documentType || "").trim().toUpperCase();
  const fallback = buildDefaultTemplate(documentType || "QUOTE");
  const layoutPreset = resolveLayoutPresetForType(documentType || fallback.documentType, row.layoutPreset);
  return {
    ...fallback,
    id: row.id || null,
    name: String(row.name || fallback.name).trim() || fallback.name,
    documentType: fallback.documentType,
    isDefault: Boolean(row.isDefault),
    status: TEMPLATE_STATUSES.includes(String(row.status || "").toLowerCase())
      ? String(row.status).toLowerCase()
      : fallback.status,
    pageSize: TEMPLATE_PAGE_SIZES.includes(String(row.pageSize || "").toUpperCase())
      ? String(row.pageSize).toUpperCase()
      : fallback.pageSize,
    pageOrientation: TEMPLATE_PAGE_ORIENTATIONS.includes(String(row.pageOrientation || "").toLowerCase())
      ? String(row.pageOrientation).toLowerCase()
      : fallback.pageOrientation,
    density: TEMPLATE_DENSITIES.includes(String(row.density || "").toLowerCase())
      ? String(row.density).toLowerCase()
      : fallback.density,
    layoutPreset,
    titleOverride: String(row.titleOverride || "").trim(),
    schema: normalizeTemplateSchema(row.schema, { documentType: fallback.documentType, layoutPreset }),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export function normalizeDocumentTemplateRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => normalizeDocumentTemplateRow(row));
}

export function resolveDefaultTemplateForType(rows = [], documentType = "") {
  const normalizedType = String(documentType || "").trim().toUpperCase();
  const templates = normalizeDocumentTemplateRows(rows).filter((row) => row.documentType === normalizedType);
  const activeDefault = templates.find((row) => row.isDefault && row.status !== "archived");
  if (activeDefault) return activeDefault;
  const active = templates.find((row) => row.status !== "archived");
  if (active) return active;
  return buildDefaultTemplate(normalizedType);
}

export function getAvailablePresetsForType(documentType) {
  const normalizedType = String(documentType || "").trim().toUpperCase();
  return Object.values(TEMPLATE_LAYOUT_PRESETS).filter((preset) => preset.allowedTypes.includes(normalizedType));
}
