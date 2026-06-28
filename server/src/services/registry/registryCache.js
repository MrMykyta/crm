'use strict';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const store = new Map();

function keyFor({ country, kind, value }) {
  return `${String(country || '').toUpperCase()}:${String(kind || '').toLowerCase()}:${String(value || '')}`;
}

function get(key, { allowExpired = false } = {}) {
  const entry = store.get(key);
  if (!entry) return null;
  const expired = Date.now() > entry.expiresAt;
  if (expired && !allowExpired) return null;
  return { value: entry.value, expired, updatedAt: entry.updatedAt };
}

function set(key, value, ttlMs = TTL_MS) {
  const now = Date.now();
  store.set(key, {
    value,
    updatedAt: now,
    expiresAt: now + ttlMs,
  });
}

function clear() {
  store.clear();
}

module.exports = {
  TTL_MS,
  keyFor,
  get,
  set,
  clear,
};
