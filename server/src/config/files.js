// Unified Files System — central config
// Keep all file storage settings in one place for DEV/PROD parity.
'use strict';
const path = require('path');

const STORAGE_ROOT = process.env.FILES_STORAGE_ROOT || process.cwd();
const PRIVATE_ROOT = path.join(STORAGE_ROOT, 'uploads');
const PUBLIC_ROOT = path.join(STORAGE_ROOT, 'public-uploads');
const TMP_ROOT = path.join(STORAGE_ROOT, 'uploads-tmp');

const MAX_SIZE_MB = Number(process.env.FILES_MAX_SIZE_MB || 20);
const MAX_SIZE_BYTES = Math.max(1, MAX_SIZE_MB) * 1024 * 1024;

const PUBLIC_ENABLED =
  typeof process.env.FILES_PUBLIC_ENABLED === 'string'
    ? process.env.FILES_PUBLIC_ENABLED !== 'false'
    : true;

// Secret for short-lived signed URLs (inline images)
const SIGNING_SECRET =
  process.env.FILES_SIGNING_SECRET ||
  process.env.JWT_SECRET ||
  'dev-files-secret';

// Signed URL TTL (seconds)
const SIGNED_URL_TTL_SEC = Number(process.env.FILES_SIGNED_URL_TTL_SEC || 86400);

module.exports = {
  STORAGE_ROOT,
  PRIVATE_ROOT,
  PUBLIC_ROOT,
  TMP_ROOT,
  MAX_SIZE_MB,
  MAX_SIZE_BYTES,
  PUBLIC_ENABLED,
  SIGNING_SECRET,
  SIGNED_URL_TTL_SEC,
};
