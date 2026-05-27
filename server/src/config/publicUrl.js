'use strict';

const rawAppPublicUrl = String(process.env.APP_PUBLIC_URL || '').trim();
const APP_PUBLIC_URL = rawAppPublicUrl.replace(/\/+$/, '');

if (!APP_PUBLIC_URL) {
  throw new Error('APP_PUBLIC_URL is not configured');
}

let parsedBaseUrl;
try {
  parsedBaseUrl = new URL(APP_PUBLIC_URL);
} catch {
  throw new Error(`APP_PUBLIC_URL is invalid: ${APP_PUBLIC_URL}`);
}

function buildPublicUrl(pathname = '/', query = {}) {
  const normalizedPath = String(pathname || '/').startsWith('/')
    ? String(pathname || '/')
    : `/${String(pathname || '/')}`;

  const url = new URL(normalizedPath, parsedBaseUrl.toString());
  Object.entries(query || {}).forEach(([key, value]) => {
    if (typeof value === 'undefined' || value === null) return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

module.exports = {
  APP_PUBLIC_URL,
  buildPublicUrl,
};
