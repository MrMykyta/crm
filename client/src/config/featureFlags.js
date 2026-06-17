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
  'WMS_SHELL_PZ_CREATE',
  'WMS_SHELL_PZ_DRAFT_EDIT',
  'WMS_SHELL_WZ_CREATE',
  'WMS_SHELL_WZ_SHIP',
  'WMS_SHELL_MM_CREATE',
  'WMS_SHELL_MM_EXECUTE',
  'WMS_SHELL_ADJUSTMENT_CREATE',
  'WMS_SHELL_ADJUSTMENT_POST',
  'WMS_SHELL_CC_CREATE',
  'WMS_SHELL_CC_RECONCILE',
  'WMS_UI_DASH_WIDGETS',
  'WMS_UI_NAV',
  'WMS_UI_DOCUMENTS',
]);

function readEnvFlag(key) {
  const envMap = {
    WMS_SHELL_PZ_CREATE: process.env.REACT_APP_WMS_SHELL_PZ_CREATE,
    WMS_SHELL_PZ_DRAFT_EDIT: process.env.REACT_APP_WMS_SHELL_PZ_DRAFT_EDIT,
    WMS_SHELL_WZ_CREATE: process.env.REACT_APP_WMS_SHELL_WZ_CREATE,
    WMS_SHELL_WZ_SHIP: process.env.REACT_APP_WMS_SHELL_WZ_SHIP,
    WMS_SHELL_MM_CREATE: process.env.REACT_APP_WMS_SHELL_MM_CREATE,
    WMS_SHELL_MM_EXECUTE: process.env.REACT_APP_WMS_SHELL_MM_EXECUTE,
    WMS_SHELL_ADJUSTMENT_CREATE: process.env.REACT_APP_WMS_SHELL_ADJUSTMENT_CREATE,
    WMS_SHELL_ADJUSTMENT_POST: process.env.REACT_APP_WMS_SHELL_ADJUSTMENT_POST,
    WMS_SHELL_CC_CREATE: process.env.REACT_APP_WMS_SHELL_CC_CREATE,
    WMS_SHELL_CC_RECONCILE: process.env.REACT_APP_WMS_SHELL_CC_RECONCILE,
    WMS_UI_DASH_WIDGETS: process.env.REACT_APP_WMS_UI_DASH_WIDGETS,
    WMS_UI_NAV: process.env.REACT_APP_WMS_UI_NAV,
    WMS_UI_DOCUMENTS: process.env.REACT_APP_WMS_UI_DOCUMENTS,
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

export function isWmsShellPzCreateEnabled() {
  return isFeatureEnabled('WMS_SHELL_PZ_CREATE');
}

export function isWmsShellPzDraftEditEnabled() {
  return isFeatureEnabled('WMS_SHELL_PZ_DRAFT_EDIT');
}

export function isWmsShellWzCreateEnabled() {
  return isFeatureEnabled('WMS_SHELL_WZ_CREATE');
}

export function isWmsShellWzShipEnabled() {
  return isFeatureEnabled('WMS_SHELL_WZ_SHIP');
}

export function isWmsShellMmCreateEnabled() {
  return isFeatureEnabled('WMS_SHELL_MM_CREATE');
}

export function isWmsShellMmExecuteEnabled() {
  return isFeatureEnabled('WMS_SHELL_MM_EXECUTE');
}

export function isWmsShellAdjustmentCreateEnabled() {
  return isFeatureEnabled('WMS_SHELL_ADJUSTMENT_CREATE');
}

export function isWmsShellAdjustmentPostEnabled() {
  return isFeatureEnabled('WMS_SHELL_ADJUSTMENT_POST');
}

export function isWmsShellCcCreateEnabled() {
  return isFeatureEnabled('WMS_SHELL_CC_CREATE');
}

export function isWmsShellCcReconcileEnabled() {
  return isFeatureEnabled('WMS_SHELL_CC_RECONCILE');
}

export function isWmsUiDashWidgetsEnabled() {
  return isFeatureEnabled('WMS_UI_DASH_WIDGETS');
}

export function isWmsUiNavEnabled() {
  return isFeatureEnabled('WMS_UI_NAV');
}

export function isWmsUiDocumentsEnabled() {
  return isFeatureEnabled('WMS_UI_DOCUMENTS');
}
