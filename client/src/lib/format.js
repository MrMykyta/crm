// src/lib/format.js
// Shared formatting helpers (UI-2). Single source of truth for money/date/qty/percent
// formatting that previously lived duplicated inside OMS detail pages.
// Locale-aware via Intl; safe on null/undefined/empty input (returns DASH).

export const DASH = '—';
const DEFAULT_CURRENCY = 'PLN';

// asText: trim-safe string coercion.
export function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

// asNumber: parse to finite number or null.
export function asNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * formatMoney(value, currency?, locale?)
 * Positional signature kept compatible with the previous OMS-local helper.
 * @returns "1 234,56 PLN" or DASH
 */
export function formatMoney(value, currency = DEFAULT_CURRENCY, locale = 'en') {
  const amount = asNumber(value);
  if (amount === null) return DASH;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${asText(currency) || DEFAULT_CURRENCY}`;
}

/**
 * formatDate(value, locale?, options?)
 * Default = date + time (matches former OMS helper). Pass options to override.
 * @returns localized datetime string, the raw text if unparseable, or DASH
 */
export function formatDate(value, locale = 'en', options) {
  const text = asText(value);
  if (!text) return DASH;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat(locale, options || {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

/**
 * formatQty(value, locale?)
 * Integer-friendly with up to 4 decimals (matches former OMS helper).
 */
export function formatQty(value, locale = 'en') {
  const qty = asNumber(value);
  if (qty === null) return DASH;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(qty);
}

/**
 * formatPercent(value, locale?, fractionDigits?)
 * Accepts a percentage number (23 => "23%"), not a 0..1 ratio.
 */
export function formatPercent(value, locale = 'en', fractionDigits = 0) {
  const num = asNumber(value);
  if (num === null) return DASH;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(num);
  return `${formatted}%`;
}

/**
 * stripHtml(value) — render rich-text/HTML notes as safe plain text.
 * Converts block tags to line breaks, removes all other tags, decodes a few
 * common entities. Used for read-only display so raw markup never shows.
 */
export function stripHtml(value) {
  const s = asText(value);
  if (!s) return '';
  if (!/[<&]/.test(s)) return s;
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/**
 * formatDocumentNumber(value, prefix?)
 * Light normalization for document numbers; falls back to a short id slice.
 */
export function formatDocumentNumber(value, prefix = '') {
  const text = asText(value);
  if (text) return prefix ? `${prefix}${text}` : text;
  return DASH;
}
