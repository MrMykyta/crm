const DEFAULT_LOCALE = 'ru-RU';

// asText: вспомогательная логика модуля.
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

// normalizeQuantity: нормализует входные и выходные данные.
export function normalizeQuantity(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// getUomSymbol: возвращает вычисленные данные.
export function getUomSymbol(uom, fallback = '') {
  if (!uom || typeof uom !== 'object') return fallback;
  return asText(uom.symbol) || asText(uom.code) || asText(uom.name) || fallback;
}

// getUomLabel: возвращает вычисленные данные.
export function getUomLabel(uom, fallback = '—') {
  if (!uom || typeof uom !== 'object') return fallback;
  const symbol = getUomSymbol(uom);
  const name = asText(uom.name);
  if (symbol && name && symbol !== name) return `${symbol} · ${name}`;
  return symbol || name || fallback;
}

// getUomPrecision: возвращает вычисленные данные.
export function getUomPrecision(uom, fallback = null) {
  const raw = Number(uom?.precision);
  if (Number.isInteger(raw) && raw >= 0 && raw <= 6) return raw;

  const family = asText(uom?.family).toLowerCase();
  if (family === 'piece' || family === 'packaging' || family === 'time') return 0;
  if (family) return 3;
  return fallback;
}

// formatQuantity: форматирует данные для отображения.
export function formatQuantity(value, uom, options = {}) {
  const {
    locale = DEFAULT_LOCALE,
    withUnit = true,
    fallback = '—',
    precision: precisionOverride,
  } = options;

  const number = normalizeQuantity(value);
  if (number === null) return fallback;

  const precision = Number.isInteger(precisionOverride)
    ? precisionOverride
    : getUomPrecision(uom, null);

  const formatter = precision === null
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 3 })
    : new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });

  const formatted = formatter.format(number);
  if (!withUnit) return formatted;

  const symbol = getUomSymbol(uom, '');
  return symbol ? `${formatted} ${symbol}` : formatted;
}

