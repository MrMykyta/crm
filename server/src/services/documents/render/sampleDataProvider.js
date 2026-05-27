'use strict';

const SAMPLE_DATA = {
  faktura_vat: {
    company: {
      legalName: 'ACME Sp. z o.o.',
      name: 'ACME',
      nip: '525-000-11-22',
      regon: '012345678',
      addressLine1: 'ul. Przemysłowa 12',
      city: 'Warszawa',
      postalCode: '00-950',
      country: 'PL',
      bankAccount: '12 1140 2004 0000 3202 1234 5678',
    },
    counterparty: {
      legalName: 'Klient Biznesowy S.A.',
      name: 'Klient Biznesowy',
      nip: '783-001-44-55',
      addressLine1: 'ul. Handlowa 7',
      city: 'Poznań',
      postalCode: '60-101',
      country: 'PL',
    },
    documentType: { key: 'faktura_vat', displayName: 'Faktura VAT' },
    document: {
      number: 'FV/04/2026/0001',
      type: 'faktura_vat',
      typeLabel: 'Faktura VAT',
      issueDate: '2026-04-23',
      saleDate: '2026-04-23',
      dueDate: '2026-05-07',
      notes: 'Dziękujemy za zamówienie.',
      ksefNumber: 'KSeF:2026/04/0000123456',
      ksefDate: '2026-04-23',
    },
    payment: { methodLabel: 'Przelew', dueDate: '2026-05-07', daysNet: 14 },
    totals: {
      net: 1000,
      vat: 230,
      gross: 1230,
      byVatRate: [
        {
          rate: '23%',
          net: 1000,
          vat: 230,
          gross: 1230,
        },
      ],
    },
    items: [{ name: 'Usługa wdrożeniowa', quantity: 1, unit: 'usł.' }],
    warehouse: {},
    shipment: {},
    signatures: {},
    user: {},
    computed: {},
  },
  oferta: {
    company: {
      legalName: 'ACME Sp. z o.o.',
      name: 'ACME',
      addressLine1: 'ul. Przemysłowa 12',
      city: 'Warszawa',
      postalCode: '00-950',
      country: 'PL',
    },
    counterparty: {
      legalName: 'ABC Retail Sp. z o.o.',
      name: 'ABC Retail',
      addressLine1: 'ul. Zakupowa 22',
      city: 'Gdańsk',
      postalCode: '80-200',
      country: 'PL',
    },
    documentType: { key: 'oferta', displayName: 'Oferta Handlowa' },
    document: {
      number: 'OF/04/2026/0042',
      type: 'oferta',
      typeLabel: 'Oferta Handlowa',
      issueDate: '2026-04-23',
      saleDate: '2026-04-23',
      notes: 'Oferta ważna 30 dni od daty wystawienia.',
    },
    payment: {
      methodLabel: 'Przelew',
      dueDate: '2026-05-23',
      daysNet: 30,
      bankAccount: '43 1050 0099 1000 0091 2345 6789',
      bankName: 'ING Bank Śląski',
    },
    totals: { net: 5400, vat: 0, gross: 5400 },
    items: [{ name: 'Pakiet abonamentowy PRO', quantity: 12, unit: 'mies.' }],
    warehouse: {},
    shipment: {},
    signatures: {},
    user: {},
    computed: {},
  },
  zamowienie: {
    company: {
      legalName: 'ACME Sp. z o.o.',
      name: 'ACME',
      addressLine1: 'ul. Przemysłowa 12',
      city: 'Warszawa',
      postalCode: '00-950',
      country: 'PL',
    },
    counterparty: {
      legalName: 'Dostawca XYZ Sp. z o.o.',
      name: 'Dostawca XYZ',
      addressLine1: 'ul. Produkcyjna 88',
      city: 'Łódź',
      postalCode: '90-200',
      country: 'PL',
    },
    documentType: { key: 'zamowienie', displayName: 'Zamówienie' },
    document: {
      number: 'ZAM/04/2026/0099',
      type: 'zamowienie',
      typeLabel: 'Zamówienie',
      issueDate: '2026-04-23',
      saleDate: '2026-04-23',
      notes: 'Prosimy o realizację do 30.04.2026.',
    },
    payment: {},
    totals: { net: 3200, vat: 0, gross: 3200 },
    items: [{ name: 'Komponent A', quantity: 40, unit: 'szt' }],
    warehouse: {},
    shipment: {},
    signatures: {},
    user: {},
    computed: {},
  },
  wz: {
    company: {
      legalName: 'ACME Sp. z o.o.',
      name: 'ACME',
      addressLine1: 'ul. Przemysłowa 12',
      city: 'Warszawa',
      postalCode: '00-950',
      country: 'PL',
    },
    counterparty: {
      legalName: 'Sklep Partnerski Beta',
      name: 'Sklep Beta',
      addressLine1: 'ul. Magazynowa 5',
      city: 'Kraków',
      postalCode: '30-300',
      country: 'PL',
    },
    documentType: { key: 'wz', displayName: 'WZ' },
    document: {
      number: 'WZ/04/2026/017',
      type: 'wz',
      typeLabel: 'Wydanie zewnętrzne',
      issueDate: '2026-04-23',
      saleDate: '2026-04-23',
      notes: 'Towar wydany z magazynu głównego.',
    },
    payment: {},
    totals: { net: 0, vat: 0, gross: 0 },
    items: [
      { name: 'Produkt magazynowy A', quantity: 12, unit: 'szt' },
      { name: 'Produkt magazynowy B', quantity: 5, unit: 'szt' },
    ],
    warehouse: {},
    shipment: {},
    signatures: {},
    user: {},
    computed: {},
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getSampleDataContext(documentTypeKey) {
  const key = String(documentTypeKey || '').trim().toLowerCase();
  return clone(SAMPLE_DATA[key] || SAMPLE_DATA.faktura_vat);
}

module.exports = {
  getSampleDataContext,
};
