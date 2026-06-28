'use strict';

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return text;
}

function normalizeStreet(street, propertyNumber, apartmentNumber) {
  const base = String(street || '').trim();
  const numbers = [propertyNumber, apartmentNumber].filter(Boolean).join('/');
  return [base, numbers].filter(Boolean).join(' ').trim();
}

function normalizePolandCompany(raw = {}, { nip, source = ['GUS'] } = {}) {
  const normalizedNip = String(pick(raw.nip, raw.Nip, nip)).replace(/\D/g, '');
  const regon = String(pick(raw.regon, raw.Regon, raw.REGON)).trim();
  const krs = String(pick(raw.krs, raw.Krs, raw.KRS)).trim();
  const legalName = String(pick(raw.name, raw.nazwa, raw.Nazwa, raw.legalName)).trim();
  const city = String(pick(raw.city, raw.miejscowosc, raw.Miejscowosc, raw.MiejscowoscPoczty)).trim();
  const postalCode = String(pick(raw.postalCode, raw.kodPocztowy, raw.KodPocztowy)).trim();
  const street = normalizeStreet(
    pick(raw.street, raw.ulica, raw.Ulica),
    pick(raw.propertyNumber, raw.nrNieruchomosci, raw.NrNieruchomosci),
    pick(raw.apartmentNumber, raw.nrLokalu, raw.NrLokalu)
  );

  return {
    found: true,
    country: 'PL',
    legalName,
    shortName: legalName,
    taxIds: {
      nip: normalizedNip,
      regon: regon || null,
      krs: krs || null,
      vat: normalizedNip ? `PL${normalizedNip}` : null,
    },
    isCompany: true,
    legalForm: pick(raw.legalForm, raw.formaPrawna, raw.FormaPrawna) || null,
    address: {
      country: 'PL',
      city: city || null,
      postalCode: postalCode || null,
      street: street || null,
    },
    registrationDate: normalizeDate(pick(raw.registrationDate, raw.dataPowstania, raw.DataPowstania)),
    status: 'active',
    pkd: Array.isArray(raw.pkd) ? raw.pkd : [],
    vatStatus: null,
    bankAccounts: [],
    source,
    fetchedAt: new Date().toISOString(),
  };
}

function notFoundPolandCompany({ nip, source = ['GUS'] } = {}) {
  return {
    found: false,
    country: 'PL',
    taxIds: { nip: String(nip || '').replace(/\D/g, '') },
    source,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  normalizePolandCompany,
  notFoundPolandCompany,
};
