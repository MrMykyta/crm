const DOCUMENT_CONVERSION_CONFIG = Object.freeze({
  QUOTE: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        targetType: "ORDER",
        actionLabel: "Создать заказ",
        hint: "Преобразовать предложение в заказ на основе текущих позиций.",
      }),
      Object.freeze({
        targetType: "INVOICE",
        actionLabel: "Создать фактуру",
        hint: "Преобразовать предложение в платёжный документ.",
      }),
    ]),
  }),
  ORDER: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        targetType: "INVOICE",
        actionLabel: "Создать фактуру",
        hint: "Создать фактуру на основе подтверждённого заказа.",
      }),
    ]),
  }),
});

function normalizeType(value) {
  return String(value || "").trim().toUpperCase();
}

export function getDocumentConversionRule(fromType) {
  return DOCUMENT_CONVERSION_CONFIG[normalizeType(fromType)] || null;
}

export function getAllowedDocumentConversionTargets(fromType) {
  const rule = getDocumentConversionRule(fromType);
  if (!rule) return [];
  return rule.targets.map((target) => ({
    ...target,
  }));
}

export function isDocumentConversionAllowed(fromType, targetType) {
  const from = normalizeType(fromType);
  const target = normalizeType(targetType);
  if (!from || !target) return false;
  return getAllowedDocumentConversionTargets(from).some((item) => item.targetType === target);
}

export { DOCUMENT_CONVERSION_CONFIG };

