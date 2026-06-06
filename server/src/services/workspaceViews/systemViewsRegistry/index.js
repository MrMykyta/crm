'use strict';

// Module registry — maps `module` string (e.g. 'wms.documents') to its system views array.
// Adding a new module = adding one file here + registering it below. No migration needed.

const MODULES = Object.freeze({
  'wms.documents': require('./wms.documents'),
});

function isKnownModule(module) {
  return Object.prototype.hasOwnProperty.call(MODULES, module);
}

function getSystemViewsFor(module) {
  return MODULES[module] || [];
}

function listKnownModules() {
  return Object.keys(MODULES);
}

module.exports = { isKnownModule, getSystemViewsFor, listKnownModules, MODULES };
