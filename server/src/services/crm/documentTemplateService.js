'use strict';

const { DocumentTemplateSetting } = require('../../models');
const AppError = require('../../errors/AppError');
const {
  DOCUMENT_TYPES,
  LAYOUT_DENSITIES,
  MAX_DOCUMENT_TITLE_OVERRIDE,
  TEMPLATE_BOOLEAN_FIELDS,
  normalizeDocumentType,
  buildDefaultTemplateSetting,
  resolvePresetForType,
  isPresetAllowedForType,
  getPresetByKey,
  resolveTemplateSectionOrder,
} = require('./documentTemplateConfig');

function normalizeBatchPayload(payload = {}) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  throw new AppError(400, 'items must be an array');
}

function asBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new AppError(400, `${fieldName} must be boolean`);
  }
  return value;
}

function asDocumentTitleOverride(value) {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim();
  if (normalized.length > MAX_DOCUMENT_TITLE_OVERRIDE) {
    throw new AppError(400, `documentTitleOverride must be <= ${MAX_DOCUMENT_TITLE_OVERRIDE} chars`);
  }
  return normalized;
}

function mergeWithDefaults(documentType, row = null) {
  const defaults = buildDefaultTemplateSetting(documentType);
  if (!row) {
    return {
      id: null,
      ...defaults,
    };
  }

  const templatePreset = resolvePresetForType(documentType, row.templatePreset);
  const preset = getPresetByKey(templatePreset);
  const presetDefaults = preset?.defaults || {};

  const layoutDensity = LAYOUT_DENSITIES.includes(String(row.layoutDensity || ''))
    ? String(row.layoutDensity)
    : defaults.layoutDensity;

  const merged = {
    id: row.id,
    documentType,
    templatePreset,
    documentTitleOverride: asDocumentTitleOverride(row.documentTitleOverride),
    layoutDensity,
    sectionOrder: resolveTemplateSectionOrder(documentType, templatePreset, row.sectionOrder),
  };

  TEMPLATE_BOOLEAN_FIELDS.forEach((fieldName) => {
    if (typeof row[fieldName] === 'boolean') {
      merged[fieldName] = row[fieldName];
      return;
    }
    if (typeof defaults[fieldName] === 'boolean') {
      merged[fieldName] = defaults[fieldName];
      return;
    }
    merged[fieldName] = Boolean(presetDefaults[fieldName]);
  });

  return merged;
}

function normalizeSettingInput(item = {}) {
  const documentType = normalizeDocumentType(item.documentType);
  if (!DOCUMENT_TYPES.includes(documentType)) {
    throw new AppError(400, 'documentType is invalid');
  }

  const defaults = buildDefaultTemplateSetting(documentType);
  const templatePresetRaw = String(item.templatePreset || '').trim();
  const templatePreset = templatePresetRaw || defaults.templatePreset;
  if (!isPresetAllowedForType(documentType, templatePreset)) {
    throw new AppError(400, `templatePreset is invalid for ${documentType}`);
  }

  const layoutDensity = String(item.layoutDensity || defaults.layoutDensity).trim();
  if (!LAYOUT_DENSITIES.includes(layoutDensity)) {
    throw new AppError(400, `layoutDensity is invalid for ${documentType}`);
  }

  const normalized = {
    documentType,
    templatePreset,
    documentTitleOverride: asDocumentTitleOverride(item.documentTitleOverride),
    layoutDensity,
    sectionOrder: resolveTemplateSectionOrder(documentType, templatePreset, item.sectionOrder),
  };

  TEMPLATE_BOOLEAN_FIELDS.forEach((fieldName) => {
    if (item[fieldName] === undefined) {
      normalized[fieldName] = defaults[fieldName];
      return;
    }
    normalized[fieldName] = asBoolean(item[fieldName], `${fieldName} (${documentType})`);
  });

  return normalized;
}

async function getOrCreateSettingRow({ companyId, documentType, transaction }) {
  let row = await DocumentTemplateSetting.findOne({
    where: { companyId, documentType },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  if (row) return row;

  const defaults = buildDefaultTemplateSetting(documentType);

  try {
    await DocumentTemplateSetting.create(
      {
        companyId,
        ...defaults,
      },
      { transaction }
    );
  } catch (error) {
    if (error?.name !== 'SequelizeUniqueConstraintError') {
      throw error;
    }
  }

  row = await DocumentTemplateSetting.findOne({
    where: { companyId, documentType },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  if (!row) {
    throw new AppError(500, `Unable to initialize template settings for ${documentType}`);
  }

  return row;
}

async function listCompanyDocumentTemplateSettings({ companyId }) {
  if (!companyId) {
    throw new AppError(403, 'Company context required');
  }

  const rows = await DocumentTemplateSetting.findAll({
    where: { companyId },
    order: [['documentType', 'ASC']],
  });
  const byType = new Map(rows.map((row) => [row.documentType, row]));

  return DOCUMENT_TYPES.map((documentType) => mergeWithDefaults(documentType, byType.get(documentType) || null));
}

async function updateCompanyDocumentTemplateSettings({ companyId, payload }) {
  if (!companyId) {
    throw new AppError(403, 'Company context required');
  }

  const items = normalizeBatchPayload(payload);
  if (!items.length) {
    throw new AppError(400, 'items must not be empty');
  }

  const normalizedItems = items.map((item) => normalizeSettingInput(item));
  const seenTypes = new Set();

  normalizedItems.forEach((item) => {
    if (seenTypes.has(item.documentType)) {
      throw new AppError(400, `Duplicate documentType: ${item.documentType}`);
    }
    seenTypes.add(item.documentType);
  });

  const tx = await DocumentTemplateSetting.sequelize.transaction();
  try {
    for (const item of normalizedItems) {
      const row = await getOrCreateSettingRow({
        companyId,
        documentType: item.documentType,
        transaction: tx,
      });
      await row.update(
        {
          templatePreset: item.templatePreset,
          documentTitleOverride: item.documentTitleOverride,
          layoutDensity: item.layoutDensity,
          sectionOrder: item.sectionOrder,
          ...TEMPLATE_BOOLEAN_FIELDS.reduce((acc, fieldName) => {
            acc[fieldName] = item[fieldName];
            return acc;
          }, {}),
        },
        { transaction: tx }
      );
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  return listCompanyDocumentTemplateSettings({ companyId });
}

module.exports = {
  listCompanyDocumentTemplateSettings,
  updateCompanyDocumentTemplateSettings,
};
