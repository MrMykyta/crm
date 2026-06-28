'use strict';

const PolandRegistryProvider = require('./providers/PolandRegistryProvider');
const { getRegistryConfig } = require('../../config/registry');
const registryCache = require('./registryCache');
const { registryError } = require('./registryErrors');
const { lookupMockPolandCompanyByNip } = require('./mockRegistryData');
const { normalizeNip, isValidNip } = require('./validators/plTaxId');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withCacheMeta(value, cache, registryEnv) {
  return {
    ...clone(value),
    registryEnv,
    cache,
  };
}

function resolveProvider(country) {
  const normalized = String(country || '').toUpperCase();
  if (normalized === 'PL') return new PolandRegistryProvider();
  throw registryError('UNSUPPORTED_COUNTRY');
}

async function lookup({ country, kind, value, forceRefresh = false }) {
  const normalizedCountry = String(country || '').toUpperCase();
  const normalizedKind = String(kind || '').toLowerCase();

  if (normalizedCountry !== 'PL') throw registryError('UNSUPPORTED_COUNTRY');
  if (normalizedKind !== 'nip') throw registryError('UNSUPPORTED_KIND');

  const normalizedValue = normalizeNip(value);
  if (!isValidNip(normalizedValue)) throw registryError('INVALID_TAX_ID');
  const config = getRegistryConfig();

  if (config.registryMockActive) {
    const mockKey = registryCache.keyFor({
      country: normalizedCountry,
      kind: normalizedKind,
      value: `mock:${normalizedValue}`,
    });

    if (!forceRefresh) {
      const cachedMock = registryCache.get(mockKey);
      if (cachedMock) {
        return withCacheMeta(cachedMock.value, { hit: true, stale: false }, config.gusBirEnv);
      }
    }

    const mockResult = lookupMockPolandCompanyByNip(normalizedValue);
    if (mockResult) {
      registryCache.set(mockKey, mockResult);
      return withCacheMeta(mockResult, { hit: false, stale: false }, config.gusBirEnv);
    }
  }

  if (!config.gusBirApiKey) throw registryError('CONFIG_MISSING');

  const provider = resolveProvider(normalizedCountry);
  const key = registryCache.keyFor({
    country: normalizedCountry,
    kind: normalizedKind,
    value: normalizedValue,
  });

  if (!forceRefresh) {
    const cached = registryCache.get(key);
    if (cached) {
      return withCacheMeta(cached.value, { hit: true, stale: false }, config.gusBirEnv);
    }
  }

  try {
    const result = await provider.lookup({
      kind: normalizedKind,
      value: normalizedValue,
    });
    const resultWithEnv = { ...result, registryEnv: config.gusBirEnv };
    registryCache.set(key, resultWithEnv);
    return withCacheMeta(resultWithEnv, { hit: false, stale: false }, config.gusBirEnv);
  } catch (error) {
    const stale = registryCache.get(key, { allowExpired: true });
    if (stale) {
      return withCacheMeta(stale.value, { hit: false, stale: true }, config.gusBirEnv);
    }
    throw error;
  }
}

module.exports = {
  lookup,
  resolveProvider,
};
