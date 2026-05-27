import {
  TEMPLATE_LAYOUT_DENSITIES,
  TEMPLATE_TOGGLE_FIELDS,
  TEMPLATE_SECTION_KEYS,
  buildDefaultTemplateSetting,
  resolveTemplatePresetForType,
  resolveTemplateSectionOrder,
} from "./documentTemplatePresets";
import { DOCUMENT_TYPES } from "./documentTypeConfig";

const MAX_TITLE_OVERRIDE_LENGTH = 120;

function asBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeTemplateSettingRow(row = {}) {
  const documentType = String(row.documentType || "").trim().toUpperCase();
  const defaultRow = buildDefaultTemplateSetting(documentType);
  const safeType = DOCUMENT_TYPES.includes(documentType) ? documentType : defaultRow.documentType;
  const templatePreset = resolveTemplatePresetForType(safeType, row.templatePreset || defaultRow.templatePreset);
  const layoutDensity = TEMPLATE_LAYOUT_DENSITIES.includes(String(row.layoutDensity || ""))
    ? String(row.layoutDensity)
    : defaultRow.layoutDensity;
  const documentTitleOverride = String(row.documentTitleOverride || "").trim().slice(0, MAX_TITLE_OVERRIDE_LENGTH);

  const normalized = {
    ...defaultRow,
    documentType: safeType,
    templatePreset,
    layoutDensity,
    documentTitleOverride,
    sectionOrder: resolveTemplateSectionOrder(safeType, templatePreset, row.sectionOrder),
  };

  TEMPLATE_TOGGLE_FIELDS.forEach((fieldName) => {
    normalized[fieldName] = asBoolean(row[fieldName], defaultRow[fieldName]);
  });

  return normalized;
}

export function normalizeTemplateSettingsRows(rows = []) {
  const byType = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [String(row?.documentType || "").trim().toUpperCase(), row])
  );

  return DOCUMENT_TYPES.map((documentType) => {
    const row = byType.get(documentType);
    if (!row) return buildDefaultTemplateSetting(documentType);
    return normalizeTemplateSettingRow(row);
  });
}

export function resolveTemplateSettingForType(rows = [], documentType = "") {
  const normalizedType = String(documentType || "").trim().toUpperCase();
  const normalizedRows = normalizeTemplateSettingsRows(rows);
  const found = normalizedRows.find((row) => row.documentType === normalizedType);
  return found || buildDefaultTemplateSetting(normalizedType);
}

export function validateTemplateSettingsRows(rows = []) {
  const normalizedRows = normalizeTemplateSettingsRows(rows);

  for (const row of normalizedRows) {
    if (!DOCUMENT_TYPES.includes(row.documentType)) {
      return `documentType is invalid: ${row.documentType}`;
    }
    if (!row.templatePreset) {
      return `templatePreset is required for ${row.documentType}`;
    }
    if (!TEMPLATE_LAYOUT_DENSITIES.includes(row.layoutDensity)) {
      return `layoutDensity is invalid for ${row.documentType}`;
    }
    if (!Array.isArray(row.sectionOrder) || row.sectionOrder.some((sectionKey) => !TEMPLATE_SECTION_KEYS.includes(sectionKey))) {
      return `sectionOrder is invalid for ${row.documentType}`;
    }
    if (String(row.documentTitleOverride || "").length > MAX_TITLE_OVERRIDE_LENGTH) {
      return `documentTitleOverride must be <= ${MAX_TITLE_OVERRIDE_LENGTH} chars`;
    }
  }

  return "";
}

export { MAX_TITLE_OVERRIDE_LENGTH };
