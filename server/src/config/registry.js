'use strict';

const GUS_BIR_ENV_TEST = 'test';
const GUS_BIR_ENV_PRODUCTION = 'production';
const DEFAULT_GUS_BIR_ENV = GUS_BIR_ENV_TEST;
const OFFICIAL_TEST_ENDPOINT = 'https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
const OFFICIAL_PROD_ENDPOINT = 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isFalseyEnv(value) {
  return ['0', 'false', 'no', 'off'].includes(String(value || '').trim().toLowerCase());
}

function normalizeGusBirEnv(value) {
  const normalized = String(value || DEFAULT_GUS_BIR_ENV).trim().toLowerCase();
  return normalized === GUS_BIR_ENV_PRODUCTION ? GUS_BIR_ENV_PRODUCTION : GUS_BIR_ENV_TEST;
}

function resolveGusBirEndpoint({ endpoint, env } = {}) {
  const explicitEndpoint = String(endpoint || '').trim();
  if (explicitEndpoint) return explicitEndpoint;
  return normalizeGusBirEnv(env) === GUS_BIR_ENV_PRODUCTION
    ? OFFICIAL_PROD_ENDPOINT
    : OFFICIAL_TEST_ENDPOINT;
}

function getRegistryConfig() {
  const gusBirEnv = normalizeGusBirEnv(process.env.GUS_BIR_ENV);
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const registryMockEnabled = isTruthyEnv(process.env.REGISTRY_MOCK_ENABLED);
  const registryMockOnlyInTest = isFalseyEnv(process.env.REGISTRY_MOCK_ONLY_IN_TEST)
    ? false
    : true;
  const registryMockActive = registryMockEnabled &&
    nodeEnv !== 'production' &&
    (!registryMockOnlyInTest || gusBirEnv === GUS_BIR_ENV_TEST);

  return {
    gusBirEnv,
    gusBirApiKey: process.env.GUS_BIR_API_KEY || '',
    gusBirEndpoint: resolveGusBirEndpoint({
      endpoint: process.env.GUS_BIR_ENDPOINT,
      env: gusBirEnv,
    }),
    gusBirTimeoutMs: Number(process.env.GUS_BIR_TIMEOUT_MS || 5000),
    registryMockEnabled,
    registryMockOnlyInTest,
    registryMockActive,
  };
}

module.exports = {
  DEFAULT_GUS_BIR_ENV,
  GUS_BIR_ENV_PRODUCTION,
  GUS_BIR_ENV_TEST,
  OFFICIAL_PROD_ENDPOINT,
  OFFICIAL_TEST_ENDPOINT,
  normalizeGusBirEnv,
  resolveGusBirEndpoint,
  isTruthyEnv,
  getRegistryConfig,
};
