'use strict';

function readBooleanFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  return String(raw).toLowerCase() === 'true';
}

function isDeptScopeEnabled() {
  return readBooleanFlag('DEPT_SCOPE_ENABLED', false);
}

function isDeptScopeShadowEnabled() {
  return readBooleanFlag('DEPT_SCOPE_SHADOW', false);
}

function isDeptScopeNullVisible() {
  return readBooleanFlag('DEPT_SCOPE_NULL_VISIBLE', true);
}

function isCounterpartyDeptScopeFlagEnabled() {
  return readBooleanFlag('DEPT_SCOPE_COUNTERPARTIES', false);
}

function isCounterpartyDeptScopeEnabled() {
  return isDeptScopeEnabled() && isCounterpartyDeptScopeFlagEnabled();
}

module.exports = {
  isDeptScopeEnabled,
  isCounterpartyDeptScopeEnabled,
  isCounterpartyDeptScopeFlagEnabled,
  isDeptScopeShadowEnabled,
  isDeptScopeNullVisible,
};
