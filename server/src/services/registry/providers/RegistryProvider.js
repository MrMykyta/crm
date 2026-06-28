'use strict';

/**
 * RegistryProvider interface documentation.
 *
 * Required shape:
 * - country: ISO country code handled by this provider.
 * - supports(kind): boolean
 * - validateFormat({ kind, value }): boolean
 * - lookup({ kind, value }): Promise<NormalizedCompany>
 */
class RegistryProvider {
  constructor(country) {
    this.country = country;
  }

  supports() {
    return false;
  }

  validateFormat() {
    return false;
  }

  async lookup() {
    throw new Error('RegistryProvider.lookup is not implemented');
  }
}

module.exports = RegistryProvider;
