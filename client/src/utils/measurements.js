const WEIGHT_FACTORS_TO_KG = Object.freeze({
  g: 0.001,
  kg: 1,
  t: 1000,
});

const LENGTH_FACTORS_TO_MM = Object.freeze({
  mm: 1,
  cm: 10,
  m: 1000,
});

const VOLUME_FACTORS_TO_MM3 = Object.freeze({
  mm3: 1,
  cm3: 1000,
  m3: 1000000000,
});

// asNumber: вспомогательная логика модуля.
function asNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// normalizeDisplayedNumber: нормализует входные и выходные данные.
export function normalizeDisplayedNumber(input) {
  const text = String(input || '').replace(',', '.').trim();
  if (!text.length) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

// convertValue: вспомогательная логика модуля.
export function convertValue(value, fromUnit, toUnit, factors = {}) {
  const num = asNumber(value);
  if (num === null) return null;

  const fromFactor = Number(factors[fromUnit]);
  const toFactor = Number(factors[toUnit]);
  if (!Number.isFinite(fromFactor) || fromFactor <= 0) return null;
  if (!Number.isFinite(toFactor) || toFactor <= 0) return null;

  const baseValue = num * fromFactor;
  return baseValue / toFactor;
}

// formatMeasurement: форматирует данные для отображения.
export function formatMeasurement(value, unit, precision = 3, locale = 'ru-RU') {
  const num = asNumber(value);
  if (num === null) return '—';
  const safePrecision = Number.isInteger(precision) ? Math.max(0, Math.min(6, precision)) : 3;
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: safePrecision,
    maximumFractionDigits: safePrecision,
  }).format(num);
  return unit ? `${text} ${unit}` : text;
}

// toEditableMeasurement: вспомогательная логика модуля.
export function toEditableMeasurement(value, maxDigits = 6) {
  const num = asNumber(value);
  if (num === null) return '';
  const fixed = Number(num.toFixed(Math.max(0, Math.min(8, maxDigits))));
  if (!Number.isFinite(fixed)) return '';
  return String(fixed);
}

// parseDisplayedMeasurement: парсит входные данные.
export function parseDisplayedMeasurement(input, selectedUnit, baseUnit, factors = {}) {
  const parsed = normalizeDisplayedNumber(input);
  if (parsed === null) return null;
  return convertValue(parsed, selectedUnit, baseUnit, factors);
}

// convertWeight: вспомогательная логика модуля.
export function convertWeight(value, fromUnit, toUnit) {
  return convertValue(value, fromUnit, toUnit, WEIGHT_FACTORS_TO_KG);
}

// convertLength: вспомогательная логика модуля.
export function convertLength(value, fromUnit, toUnit) {
  return convertValue(value, fromUnit, toUnit, LENGTH_FACTORS_TO_MM);
}

// convertVolume: вспомогательная логика модуля.
export function convertVolume(value, fromUnit, toUnit) {
  return convertValue(value, fromUnit, toUnit, VOLUME_FACTORS_TO_MM3);
}

export const UNIT_FACTORS = Object.freeze({
  weight: WEIGHT_FACTORS_TO_KG,
  length: LENGTH_FACTORS_TO_MM,
  volume: VOLUME_FACTORS_TO_MM3,
});

