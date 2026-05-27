'use strict';

const AppError = require('../../errors/AppError');
const { CompanyWarehouseDocumentSetting } = require('../../models');
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
  WAREHOUSE_DOCUMENT_TYPE_DEFINITIONS,
  WAREHOUSE_DOCUMENT_TYPE_KEYS,
  DEFAULT_WAREHOUSE_DOCUMENT_SETTINGS,
  getWarehouseDocumentTypeDefinition,
} = require('./warehouseDocumentSettingsConfig');

function asText(value) {
  return String(value ?? '').trim();
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
    const fallbackValue = asText(fallback);
    return fallbackValue || '0';
  }
}

function ensureCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
}

function normalizeDefaultType(
  value,
  fallback = DEFAULT_WAREHOUSE_DOCUMENT_SETTINGS.warehouseDefaultDocumentType
) {
  const normalized = asText(value || fallback).toLowerCase();
  if (!WAREHOUSE_DOCUMENT_TYPE_KEYS.includes(normalized)) {
    throw new AppError(400, 'warehouseDefaultDocumentType is invalid', {
      code: 'VALIDATION_ERROR',
      details: { allowed: WAREHOUSE_DOCUMENT_TYPE_KEYS },
    });
  }
  return normalized;
}

function buildNumberingMap(numberingItems = []) {
  const map = new Map();
  (numberingItems || []).forEach((item) => {
    const key = String(item?.documentType || '').toUpperCase();
    if (key) {
      map.set(key, item);
    }
  });
  return map;
}

function normalizeWarehouseTypeState(numberingMap = new Map()) {
  return WAREHOUSE_DOCUMENT_TYPE_DEFINITIONS.map((definition) => {
    const numberingRow = numberingMap.get(definition.numberingSourceType);
    const nextSequence = normalizeSequenceForResponse(numberingRow?.nextSequence, 1);
    const rawLastSequence = Number(numberingRow?.lastSequence);
    const lastSequence = Number.isInteger(rawLastSequence) && rawLastSequence >= 0
      ? rawLastSequence
      : Math.max(nextSequence - 1, 0);
    const numberPattern = numberingRow?.pattern
      ? backendPatternToUiPattern(numberingRow.pattern)
      : definition.fallbackPattern;

    const nextNumber = buildPreviewSafely({
      pattern: numberPattern,
      sequence: nextSequence,
      fallback: numberingRow?.nextNumberPreview || definition.fallbackNextNumber,
    });
    const lastNumber = lastSequence > 0
      ? buildPreviewSafely({
        pattern: numberPattern,
        sequence: lastSequence,
        fallback: numberingRow?.lastNumberPreview || numberingRow?.lastNumber || definition.fallbackLastNumber,
      })
      : '0';

    return {
      typeKey: definition.typeKey,
      label: definition.label,
      enabled:
        numberingRow?.enabled === undefined ? Boolean(definition.defaultEnabled) : Boolean(numberingRow.enabled),
      numberingType: definition.numberingType,
      numberingSourceType: definition.numberingSourceType,
      numberPattern,
      lastSequence,
      lastNumber,
      nextSequence,
      nextNumber,
    };
  });
}

function ensureHasEnabledType(typeState = []) {
  const enabledCount = (typeState || []).filter((entry) => entry.enabled).length;
  if (enabledCount <= 0) {
    throw new AppError(400, 'At least one warehouse document type must stay enabled', {
      code: 'VALIDATION_ERROR',
    });
  }
}

function ensureDefaultTypeEnabled(typeState = [], defaultType) {
  const row = (typeState || []).find((entry) => entry.typeKey === defaultType);
  if (!row || !row.enabled) {
    throw new AppError(400, 'warehouseDefaultDocumentType must point to an enabled type', {
      code: 'VALIDATION_ERROR',
      details: { warehouseDefaultDocumentType: defaultType },
    });
  }
}

function stabilizeDefaultType(typeState = [], maybeDefaultType) {
  const preferred = normalizeDefaultType(maybeDefaultType);
  const preferredEnabled = (typeState || []).find(
    (entry) => entry.typeKey === preferred && Boolean(entry.enabled)
  );
  if (preferredEnabled) {
    return preferredEnabled.typeKey;
  }

  const firstEnabled = (typeState || []).find((entry) => Boolean(entry.enabled));
  return firstEnabled?.typeKey || DEFAULT_WAREHOUSE_DOCUMENT_SETTINGS.warehouseDefaultDocumentType;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function collectTypeOverrides(updates = []) {
  const enabledMap = new Map();
  const patternMap = new Map();

  (updates || []).forEach((entry) => {
    const typeKey = asText(entry?.typeKey).toLowerCase();
    const definition = getWarehouseDocumentTypeDefinition(typeKey);
    if (!definition) {
      throw new AppError(400, `warehouseDocumentTypes contains unknown typeKey "${typeKey}"`, {
        code: 'VALIDATION_ERROR',
      });
    }

    if (hasOwn(entry, 'numberingType')) {
      const providedNumberingType = asText(entry?.numberingType).toUpperCase();
      if (providedNumberingType !== asText(definition.numberingType).toUpperCase()) {
        throw new AppError(400, `warehouseDocumentTypes.${typeKey}.numberingType is invalid`, {
          code: 'VALIDATION_ERROR',
        });
      }
    }

    if (hasOwn(entry, 'enabled')) {
      enabledMap.set(typeKey, Boolean(entry?.enabled));
    }

    if (hasOwn(entry, 'numberPattern')) {
      patternMap.set(
        typeKey,
        uiPatternToBackendPattern(entry?.numberPattern, `warehouseDocumentTypes.${typeKey}.numberPattern`)
      );
    }
  });

  return { enabledMap, patternMap };
}

function buildUsageState({ settingsRow, numberingItems }) {
  const numberingMap = buildNumberingMap(numberingItems || []);
  const warehouseDocumentTypes = normalizeWarehouseTypeState(numberingMap);
  ensureHasEnabledType(warehouseDocumentTypes);

  const rowData = settingsRow?.get ? settingsRow.get({ plain: true }) : settingsRow || {};
  const providedDefault = normalizeDefaultType(
    rowData?.warehouseDefaultDocumentType,
    DEFAULT_WAREHOUSE_DOCUMENT_SETTINGS.warehouseDefaultDocumentType
  );
  const warehouseDefaultDocumentType = stabilizeDefaultType(warehouseDocumentTypes, providedDefault);
  const defaultDefinition = getWarehouseDocumentTypeDefinition(warehouseDefaultDocumentType)
    || getWarehouseDocumentTypeDefinition(DEFAULT_WAREHOUSE_DOCUMENT_SETTINGS.warehouseDefaultDocumentType);

  return {
    warehouseDefaultDocumentType,
    warehouseDefaultNumberingType: defaultDefinition?.numberingType || 'WZ',
    warehouseDefaultNumberingSourceType: defaultDefinition?.numberingSourceType || 'WZ',
    warehouseDocumentTypes,
  };
}

async function loadSettingsRows({ companyId, transaction = null } = {}) {
  const [settingsRow, numberingItems] = await Promise.all([
    CompanyWarehouseDocumentSetting.findOne({
      where: { companyId },
      transaction,
    }),
    listCompanyNumberingSettings({
      companyId,
      transaction,
    }),
  ]);

  return {
    settingsRow,
    numberingItems,
  };
}

async function getCompanyWarehouseDocumentSettingsForUsage({ companyId, transaction = null } = {}) {
  ensureCompanyId(companyId);
  const rows = await loadSettingsRows({ companyId, transaction });
  const usage = buildUsageState(rows);

  return {
    warehouseDefaultDocumentType: usage.warehouseDefaultDocumentType,
    warehouseDefaultNumberingType: usage.warehouseDefaultNumberingType,
    warehouseDefaultNumberingSourceType: usage.warehouseDefaultNumberingSourceType,
    warehouseDocumentTypes: usage.warehouseDocumentTypes.map((entry) => ({
      typeKey: entry.typeKey,
      enabled: Boolean(entry.enabled),
      numberingType: entry.numberingType,
      numberingSourceType: entry.numberingSourceType,
    })),
  };
}

async function getCompanyWarehouseDocumentSettings({ companyId, transaction = null } = {}) {
  ensureCompanyId(companyId);
  const rows = await loadSettingsRows({ companyId, transaction });
  const usage = buildUsageState(rows);

  return {
    warehouseDefaultDocumentType: usage.warehouseDefaultDocumentType,
    warehouseDocumentTypes: usage.warehouseDocumentTypes.map((entry) => ({
      typeKey: entry.typeKey,
      label: entry.label,
      enabled: Boolean(entry.enabled),
      numberingType: entry.numberingType,
      numberPattern: entry.numberPattern,
      lastSequence: entry.lastSequence,
      lastNumber: entry.lastNumber,
      nextSequence: entry.nextSequence,
      nextNumber: entry.nextNumber,
    })),
  };
}

async function updateCompanyWarehouseDocumentSettings({ companyId, payload = {}, transaction = null } = {}) {
  ensureCompanyId(companyId);

  const ownTransaction = !transaction;
  const tx = transaction || (await CompanyWarehouseDocumentSetting.sequelize.transaction());
  try {
    const rows = await loadSettingsRows({ companyId, transaction: tx });
    const base = buildUsageState(rows);

    const { enabledMap, patternMap } = hasOwn(payload, 'warehouseDocumentTypes')
      ? collectTypeOverrides(payload?.warehouseDocumentTypes || [])
      : { enabledMap: new Map(), patternMap: new Map() };

    const nextTypeState = base.warehouseDocumentTypes.map((entry) => ({
      ...entry,
      enabled: enabledMap.has(entry.typeKey) ? Boolean(enabledMap.get(entry.typeKey)) : Boolean(entry.enabled),
    }));
    ensureHasEnabledType(nextTypeState);

    const nextDefaultType = normalizeDefaultType(
      hasOwn(payload, 'warehouseDefaultDocumentType')
        ? payload?.warehouseDefaultDocumentType
        : base.warehouseDefaultDocumentType
    );
    ensureDefaultTypeEnabled(nextTypeState, nextDefaultType);

    if (rows.settingsRow) {
      await rows.settingsRow.update(
        { warehouseDefaultDocumentType: nextDefaultType },
        { transaction: tx }
      );
    } else {
      await CompanyWarehouseDocumentSetting.create(
        {
          companyId,
          warehouseDefaultDocumentType: nextDefaultType,
        },
        { transaction: tx }
      );
    }

    for (const entry of nextTypeState) {
      const patch = {};
      const baseEntry = base.warehouseDocumentTypes.find((row) => row.typeKey === entry.typeKey);
      if (enabledMap.has(entry.typeKey) && Boolean(baseEntry?.enabled) !== Boolean(entry.enabled)) {
        patch.enabled = Boolean(entry.enabled);
      }
      if (patternMap.has(entry.typeKey)) {
        patch.pattern = patternMap.get(entry.typeKey);
      }

      if (!Object.keys(patch).length) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await updateCompanyNumberingSetting({
        companyId,
        documentType: entry.numberingSourceType,
        payload: patch,
        transaction: tx,
      });
    }

    if (ownTransaction) {
      await tx.commit();
    }
    return getCompanyWarehouseDocumentSettings({ companyId });
  } catch (error) {
    if (ownTransaction) {
      await tx.rollback();
    }
    throw error;
  }
}

module.exports = {
  getCompanyWarehouseDocumentSettings,
  getCompanyWarehouseDocumentSettingsForUsage,
  updateCompanyWarehouseDocumentSettings,
};
