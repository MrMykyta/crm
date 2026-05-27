'use strict';

const parseOrigins = (raw = '') =>
  String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS || '');
const allowedOriginsSet = new Set(allowedOrigins);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOriginsSet.has(origin);
}

function validateOrigin(origin, callback) {
  if (isAllowedOrigin(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`CORS blocked: ${origin}`));
}

module.exports = {
  parseOrigins,
  allowedOrigins,
  isAllowedOrigin,
  validateOrigin,
};
