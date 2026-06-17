import { wmsTones } from './wmsTokens.js';

export const WMS_STATUS_MARKERS = Object.freeze({
  solid: 'solid',
  half: 'half',
  warning: 'warning',
  danger: 'danger',
  expiry: 'expiry',
  cursor: 'cursor',
});

const STATUS_TONE = Object.freeze({
  draft: wmsTones.neutral,
  new: wmsTones.neutral,
  planned: wmsTones.neutral,
  open: wmsTones.neutral,
  counting: wmsTones.progress,

  packing: wmsTones.progress,
  picking: wmsTones.progress,
  in_transit: wmsTones.progress,
  intransit: wmsTones.progress,
  partial: wmsTones.progress,
  partial_received: wmsTones.progress,
  partially_received: wmsTones.progress,
  partially_shipped: wmsTones.progress,
  needs_action: wmsTones.warning,

  received: wmsTones.success,
  shipped: wmsTones.success,
  posted: wmsTones.success,
  reconciled: wmsTones.success,
  completed: wmsTones.success,
  done: wmsTones.success,
  active: wmsTones.success,

  warning: wmsTones.warning,
  blocked: wmsTones.danger,
  blocking: wmsTones.danger,
  failed: wmsTones.danger,
  error: wmsTones.danger,
  negative: wmsTones.danger,

  corrected: wmsTones.muted,
  canceled: wmsTones.muted,
  cancelled: wmsTones.muted,
  closed: wmsTones.muted,
  archived: wmsTones.muted,
  inactive: wmsTones.muted,
});

const TONE_MARKER = Object.freeze({
  [wmsTones.neutral]: WMS_STATUS_MARKERS.solid,
  [wmsTones.progress]: WMS_STATUS_MARKERS.half,
  [wmsTones.success]: WMS_STATUS_MARKERS.solid,
  [wmsTones.warning]: WMS_STATUS_MARKERS.warning,
  [wmsTones.danger]: WMS_STATUS_MARKERS.danger,
  [wmsTones.muted]: WMS_STATUS_MARKERS.solid,
  [wmsTones.info]: WMS_STATUS_MARKERS.solid,
});

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function getWmsStatusTone(status, fallbackTone = wmsTones.neutral) {
  const normalized = normalizeStatus(status);
  return STATUS_TONE[normalized] || fallbackTone;
}

export function getWmsStatusMarker(statusOrTone, explicitTone) {
  const tone = explicitTone || getWmsStatusTone(statusOrTone);
  return TONE_MARKER[tone] || WMS_STATUS_MARKERS.solid;
}

export function isWmsStatusFinal(status) {
  return getWmsStatusTone(status) === wmsTones.success;
}

export function getWmsStatusLabel(status, fallback = '-') {
  const text = String(status || '').trim();
  return text || fallback;
}

export const wmsStatusModel = Object.freeze({
  tones: STATUS_TONE,
  markers: WMS_STATUS_MARKERS,
  getTone: getWmsStatusTone,
  getMarker: getWmsStatusMarker,
  isFinal: isWmsStatusFinal,
  getLabel: getWmsStatusLabel,
});

export default wmsStatusModel;
