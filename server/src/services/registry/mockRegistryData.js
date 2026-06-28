'use strict';

const { normalizePolandCompany } = require('./normalizers/normalizePolandCompany');
const { normalizeNip } = require('./validators/plTaxId');

const MOCK_SOURCE = ['MOCK_GUS'];

const MOCK_POLAND_COMPANIES_BY_NIP = new Map([
  ['7272898154', {
    nip: '7272898154',
    regon: '389000001',
    krs: '0000890001',
    legalName: 'DriveSafe Sp. z o.o.',
    city: 'Łódź',
    postalCode: '90-001',
    street: 'Piotrkowska 100',
    legalForm: 'Sp. z o.o.',
    pkd: ['45.20.Z'],
  }],
  ['7011055830', {
    nip: '7011055830',
    regon: '389000002',
    krs: '0000890002',
    legalName: 'AutoParts Demo Sp. z o.o.',
    city: 'Warszawa',
    postalCode: '00-001',
    street: 'Marszałkowska 10',
    legalForm: 'Sp. z o.o.',
    pkd: ['45.31.Z'],
  }],
  ['5261040828', {
    nip: '5261040828',
    regon: '389000003',
    krs: '0000890003',
    legalName: 'ServiceFleet Demo Sp. z o.o.',
    city: 'Kraków',
    postalCode: '31-001',
    street: 'Floriańska 20',
    legalForm: 'Sp. z o.o.',
    pkd: ['77.11.Z'],
  }],
]);

function lookupMockPolandCompanyByNip(value) {
  const nip = normalizeNip(value);
  const record = MOCK_POLAND_COMPANIES_BY_NIP.get(nip);
  if (!record) return null;
  return {
    ...normalizePolandCompany(record, { nip, source: MOCK_SOURCE }),
    registryEnv: 'test',
    mock: true,
  };
}

module.exports = {
  MOCK_SOURCE,
  MOCK_POLAND_COMPANIES_BY_NIP,
  lookupMockPolandCompanyByNip,
};
