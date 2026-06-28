'use strict';

function normalizeNip(value) {
  return String(value || '')
    .trim()
    .replace(/^PL/i, '')
    .replace(/[\s-]/g, '');
}

function isValidNip(value) {
  const nip = normalizeNip(value);
  if (!/^\d{10}$/.test(nip)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, weight, index) => acc + weight * Number(nip[index]), 0);
  const checksum = sum % 11;
  return checksum !== 10 && checksum === Number(nip[9]);
}

module.exports = {
  normalizeNip,
  isValidNip,
};
