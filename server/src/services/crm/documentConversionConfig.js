'use strict';

const DOCUMENT_CONVERSION_CONFIG = Object.freeze({
  QUOTE: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        targetType: 'ORDER',
        actionLabel: 'Создать заказ',
      }),
      Object.freeze({
        targetType: 'INVOICE',
        actionLabel: 'Создать фактуру',
      }),
    ]),
  }),
  ORDER: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        targetType: 'INVOICE',
        actionLabel: 'Создать фактуру',
      }),
    ]),
  }),
});

function normalizeType(value) {
  return String(value || '').trim().toUpperCase();
}

function getConversionRule(fromType) {
  return DOCUMENT_CONVERSION_CONFIG[normalizeType(fromType)] || null;
}

function getAllowedConversionTargets(fromType) {
  const rule = getConversionRule(fromType);
  if (!rule) return [];
  return rule.targets.map((target) => ({
    ...target,
  }));
}

function isDocumentConversionAllowed(fromType, targetType) {
  const from = normalizeType(fromType);
  const target = normalizeType(targetType);
  if (!from || !target) return false;
  const targets = getAllowedConversionTargets(from);
  return targets.some((item) => item.targetType === target);
}

module.exports = {
  DOCUMENT_CONVERSION_CONFIG,
  getAllowedConversionTargets,
  isDocumentConversionAllowed,
};

