'use strict';

const INVOICE_DEFAULT_TYPE_KEYS = Object.freeze([
  'invoice',
  'correction',
  'proforma',
  'advance',
  'advance_proforma',
  'wdt',
]);

const INVOICE_PAYMENT_METHODS = Object.freeze([
  'bank_transfer',
  'cash',
  'card',
  'blik',
  'online',
  'cash_on_delivery',
  'other',
]);

const INVOICE_PAYMENT_TERM_DAYS = Object.freeze([0, 3, 7, 14, 21, 30, 45, 60, 90]);

const INVOICE_CURRENCIES = Object.freeze([
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CZK',
  'SEK',
  'NOK',
  'DKK',
  'UAH',
  'HUF',
  'RON',
  'BGN',
  'TRY',
  'CAD',
  'AUD',
  'JPY',
  'CNY',
]);

const INVOICE_STOCK_UPDATE_MODES = Object.freeze(['disabled', 'create_warehouse_document']);
const INVOICE_ANNOTATION_MODES = Object.freeze(['empty', 'copy_from_documents', 'template']);

const DEFAULT_INVOICE_SETTINGS = Object.freeze({
  invoiceDefaultType: 'invoice',
  invoiceDefaultPaymentMethod: 'bank_transfer',
  invoiceDefaultPaymentTermDays: 30,
  invoiceDefaultCurrency: 'PLN',
  invoiceStockUpdateMode: 'disabled',
  invoiceAnnotationMode: 'empty',
  invoiceAnnotationTemplateHtml: null,
});

const INVOICE_TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({
    typeKey: 'invoice',
    label: 'Faktura',
    defaultEnabled: true,
    numberingType: 'INVOICE',
    numberingSourceType: 'INVOICE',
    fallbackPattern: 'FV/$Y/$M/$NY(4)',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'FV/2026/01/0002',
  }),
  Object.freeze({
    typeKey: 'correction',
    label: 'Faktura korygujaca',
    defaultEnabled: true,
    numberingType: 'INVOICE_CORRECTION',
    numberingSourceType: 'INVOICE_CORRECTION',
    fallbackPattern: 'FVK/$Y/$M/$NY(4)',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'FVK/2026/01/0002',
  }),
  Object.freeze({
    typeKey: 'proforma',
    label: 'Faktura proforma',
    defaultEnabled: true,
    numberingType: 'INVOICE_PROFORMA',
    numberingSourceType: 'PROFORMA',
    fallbackPattern: 'FV/$Y/$M/$NY(4)/PRO',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'FV/2026/01/0002/PRO',
  }),
  Object.freeze({
    typeKey: 'advance',
    label: 'Faktura zaliczkowa',
    defaultEnabled: false,
    numberingType: 'INVOICE_ADVANCE',
    numberingSourceType: 'ADVANCE_INVOICE',
    fallbackPattern: 'FVZ/$Y/$M/$NY(4)',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'FVZ/2026/01/0002',
  }),
  Object.freeze({
    typeKey: 'advance_proforma',
    label: 'Faktura zaliczkowa proforma',
    defaultEnabled: false,
    numberingType: 'INVOICE_ADVANCE_PROFORMA',
    numberingSourceType: 'ADVANCE_PROFORMA',
    fallbackPattern: 'FVZ/$Y/$M/$NY(4)/PRO',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'FVZ/2026/01/0002/PRO',
  }),
  Object.freeze({
    typeKey: 'wdt',
    label: 'Faktura WDT',
    defaultEnabled: false,
    numberingType: 'INVOICE_WDT',
    numberingSourceType: 'WDT_INVOICE',
    fallbackPattern: 'FV/$Y/$M/$NY(4)/WDT',
    fallbackLastNumber: '0',
    fallbackNextNumber: 'FV/2026/01/0002/WDT',
  }),
]);

const INVOICE_TYPE_BY_KEY = Object.freeze(
  INVOICE_TYPE_DEFINITIONS.reduce((acc, entry) => {
    acc[entry.typeKey] = entry;
    return acc;
  }, {})
);

function getInvoiceTypeDefinition(typeKey) {
  return INVOICE_TYPE_BY_KEY[String(typeKey || '').trim()] || null;
}

module.exports = {
  INVOICE_DEFAULT_TYPE_KEYS,
  INVOICE_PAYMENT_METHODS,
  INVOICE_PAYMENT_TERM_DAYS,
  INVOICE_CURRENCIES,
  INVOICE_STOCK_UPDATE_MODES,
  INVOICE_ANNOTATION_MODES,
  DEFAULT_INVOICE_SETTINGS,
  INVOICE_TYPE_DEFINITIONS,
  INVOICE_TYPE_BY_KEY,
  getInvoiceTypeDefinition,
};
