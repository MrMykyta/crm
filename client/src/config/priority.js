export const PRIORITY_LEVELS = [10, 25, 50, 75, 100];

export const PRIORITY_DEFAULT = 50;

export const PRIORITY_TONES = {
  10: 'neutral',
  25: 'muted',
  50: 'info',
  75: 'warning',
  100: 'danger',
};

export const PRIORITY_I18N_KEYS = {
  10: 'priority.levels.10',
  25: 'priority.levels.25',
  50: 'priority.levels.50',
  75: 'priority.levels.75',
  100: 'priority.levels.100',
};

const LEGACY_PRIORITY_MAP = {
  low: 25,
  medium: 50,
  normal: 50,
  high: 75,
  urgent: 100,
  critical: 100,
};

const LEGACY_NUMERIC_MAP = {
  1: 25,
  2: 50,
  3: 75,
  4: 75,
  5: 100,
};

export function snapPriority(value) {
  if (value === null || value === undefined || value === '') return PRIORITY_DEFAULT;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return PRIORITY_DEFAULT;
  if (Object.prototype.hasOwnProperty.call(LEGACY_NUMERIC_MAP, numeric)) {
    return LEGACY_NUMERIC_MAP[numeric];
  }

  if (numeric <= 17) return 10;
  if (numeric <= 37) return 25;
  if (numeric <= 62) return 50;
  if (numeric <= 87) return 75;
  return 100;
}

export function mapLegacyPriority(value) {
  if (value === null || value === undefined || value === '') return PRIORITY_DEFAULT;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LEGACY_PRIORITY_MAP, normalized)) {
      return LEGACY_PRIORITY_MAP[normalized];
    }
  }
  return snapPriority(value);
}

export function normalizePriority(value) {
  return mapLegacyPriority(value);
}

export const PRIORITY_OPTIONS = PRIORITY_LEVELS.map((value) => ({
  value,
  labelKey: PRIORITY_I18N_KEYS[value],
  tone: PRIORITY_TONES[value],
}));
