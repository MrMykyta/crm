'use strict';

const WAREHOUSE_DOCUMENT_TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({
    typeKey: 'pz',
    label: 'PZ',
    defaultEnabled: true,
    numberingType: 'PZ',
    numberingSourceType: 'PZ',
    fallbackPattern: 'PZ/$Y/$M/$NY(4)',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'PZ/2026/04/0001',
  }),
  Object.freeze({
    typeKey: 'wz',
    label: 'WZ',
    defaultEnabled: true,
    numberingType: 'WZ',
    numberingSourceType: 'WZ',
    fallbackPattern: 'WZ/$Y/$M/$NY(4)',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'WZ/2026/04/0001',
  }),
  Object.freeze({
    typeKey: 'mm',
    label: 'MM',
    defaultEnabled: true,
    numberingType: 'MM',
    numberingSourceType: 'MM',
    fallbackPattern: 'MM/$Y/$M/$NY(4)',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'MM/2026/04/0001',
  }),
  Object.freeze({
    typeKey: 'rw',
    label: 'RW',
    defaultEnabled: true,
    numberingType: 'RW',
    numberingSourceType: 'RW',
    fallbackPattern: 'RW/$Y/$M/$NY(4)',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'RW/2026/04/0001',
  }),
  Object.freeze({
    typeKey: 'pw',
    label: 'PW',
    defaultEnabled: true,
    numberingType: 'PW',
    numberingSourceType: 'PW',
    fallbackPattern: 'PW/$Y/$M/$NY(4)',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'PW/2026/04/0001',
  }),
]);

const WAREHOUSE_DOCUMENT_TYPE_BY_KEY = Object.freeze(
  WAREHOUSE_DOCUMENT_TYPE_DEFINITIONS.reduce((acc, entry) => {
    acc[entry.typeKey] = entry;
    return acc;
  }, {})
);

const WAREHOUSE_DOCUMENT_TYPE_KEYS = Object.freeze(
  WAREHOUSE_DOCUMENT_TYPE_DEFINITIONS.map((entry) => entry.typeKey)
);

const DEFAULT_WAREHOUSE_DOCUMENT_SETTINGS = Object.freeze({
  warehouseDefaultDocumentType: 'wz',
});

function getWarehouseDocumentTypeDefinition(typeKey) {
  return WAREHOUSE_DOCUMENT_TYPE_BY_KEY[String(typeKey || '').trim().toLowerCase()] || null;
}

module.exports = {
  WAREHOUSE_DOCUMENT_TYPE_DEFINITIONS,
  WAREHOUSE_DOCUMENT_TYPE_BY_KEY,
  WAREHOUSE_DOCUMENT_TYPE_KEYS,
  DEFAULT_WAREHOUSE_DOCUMENT_SETTINGS,
  getWarehouseDocumentTypeDefinition,
};
