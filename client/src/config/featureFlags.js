function readStorageFlag(key) {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return null;
    return parseFlagValue(value);
  } catch (_error) {
    return null;
  }
}

function parseFlagValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  return null;
}

const ACCEPTED_DEFAULT_ON_FLAGS = new Set([
  'WMS_UI_DASH_WIDGETS',
]);

function readEnvFlag(key) {
  const envMap = {
    WMS_UI_DASH_WIDGETS: process.env.REACT_APP_WMS_UI_DASH_WIDGETS,
  };
  return parseFlagValue(envMap[key]);
}

export function isFeatureEnabled(key) {
  const storageValue = readStorageFlag(key);
  if (storageValue !== null) return storageValue;
  const envValue = readEnvFlag(key);
  if (envValue !== null) return envValue;
  return ACCEPTED_DEFAULT_ON_FLAGS.has(key);
}

export function isWmsUiDashWidgetsEnabled() {
  return isFeatureEnabled('WMS_UI_DASH_WIDGETS');
}
