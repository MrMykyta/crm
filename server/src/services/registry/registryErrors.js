'use strict';

const AppError = require('../../errors/AppError');

const ERROR_META = {
  CONFIG_MISSING: { status: 503, message: 'Registry provider is not configured' },
  INVALID_TAX_ID: { status: 400, message: 'Invalid tax id' },
  UNSUPPORTED_COUNTRY: { status: 400, message: 'Unsupported registry country' },
  UNSUPPORTED_KIND: { status: 400, message: 'Unsupported registry lookup kind' },
  PROVIDER_ERROR: { status: 502, message: 'Registry provider error' },
  PROVIDER_TIMEOUT: { status: 504, message: 'Registry provider timeout' },
};

function registryError(code, message, details) {
  const meta = ERROR_META[code] || { status: 500, message: 'Registry lookup failed' };
  const err = new AppError(meta.status, message || meta.message, { code, details });
  err.status = meta.status;
  return err;
}

module.exports = {
  registryError,
  ERROR_META,
};
