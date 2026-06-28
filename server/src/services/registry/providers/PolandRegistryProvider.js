'use strict';

const RegistryProvider = require('./RegistryProvider');
const { getRegistryConfig } = require('../../../config/registry');
const { GusBirClient } = require('../gus/gusBirClient');
const { registryError } = require('../registryErrors');
const { normalizeNip, isValidNip } = require('../validators/plTaxId');
const {
  normalizePolandCompany,
  notFoundPolandCompany,
} = require('../normalizers/normalizePolandCompany');

class PolandRegistryProvider extends RegistryProvider {
  constructor() {
    super('PL');
  }

  supports(kind) {
    return String(kind || '').toLowerCase() === 'nip';
  }

  validateFormat({ kind, value }) {
    return this.supports(kind) && isValidNip(value);
  }

  async lookup({ kind, value }) {
    if (!this.supports(kind)) throw registryError('UNSUPPORTED_KIND');
    const nip = normalizeNip(value);
    if (!isValidNip(nip)) throw registryError('INVALID_TAX_ID');

    const config = getRegistryConfig();
    if (!config.gusBirApiKey) throw registryError('CONFIG_MISSING');

    const client = new GusBirClient({
      endpoint: config.gusBirEndpoint,
      apiKey: config.gusBirApiKey,
      timeoutMs: config.gusBirTimeoutMs,
    });

    const raw = await client.searchByNip({ nip });
    if (!raw) return notFoundPolandCompany({ nip, source: ['GUS'] });

    return normalizePolandCompany(raw, { nip, source: ['GUS'] });
  }
}

module.exports = PolandRegistryProvider;
