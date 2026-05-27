'use strict';

const { Document, DocumentItem, Counterparty, Company } = require('../../../models');
const AppError = require('../../../errors/AppError');

function safeStr(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const DOC_TYPE_LABELS = {
  INVOICE: 'Faktura VAT',
  QUOTE: 'Oferta',
  ORDER: 'Zamówienie',
  PROFORMA: 'Faktura Proforma',
  CREDIT_NOTE: 'Faktura Korygująca',
  RECEIPT: 'Paragon',
};

const DOC_TYPE_KEYS = {
  INVOICE: 'faktura_vat',
  QUOTE: 'oferta',
  ORDER: 'zamowienie',
  PROFORMA: 'proforma',
  CREDIT_NOTE: 'faktura_korygujaca',
  RECEIPT: 'paragon',
};

const PAYMENT_METHOD_LABELS = {
  transfer: 'Przelew',
  cash: 'Gotówka',
  card: 'Karta',
  online: 'Online',
  blik: 'BLIK',
};

function getDocTypeLabel(type) {
  return DOC_TYPE_LABELS[String(type || '').toUpperCase()] || safeStr(type);
}

function getDocTypeKey(type) {
  return DOC_TYPE_KEYS[String(type || '').toUpperCase()] || String(type || '').toLowerCase();
}

function getPaymentMethodLabel(method) {
  if (!method) return null;
  return PAYMENT_METHOD_LABELS[String(method).toLowerCase()] || safeStr(method);
}

function computeByVatRate(items) {
  const map = new Map();
  for (const item of items) {
    const rate = safeNum(item.vatRate, 0);
    const key = rate % 1 === 0 ? `${rate}%` : `${rate}%`;
    if (!map.has(key)) {
      map.set(key, { rate: key, net: 0, vat: 0, gross: 0 });
    }
    const entry = map.get(key);
    entry.net += safeNum(item.sumNet, 0);
    entry.vat += safeNum(item.sumVat, 0);
    entry.gross += safeNum(item.sumGross, 0);
  }
  return Array.from(map.values()).map((e) => ({
    rate: e.rate,
    net: Math.round(e.net * 100) / 100,
    vat: Math.round(e.vat * 100) / 100,
    gross: Math.round(e.gross * 100) / 100,
  }));
}

async function buildRenderContextForDocument({ companyId, documentId, transaction = null }) {
  const document = await Document.findOne({
    where: { id: documentId, companyId },
    include: [
      {
        model: Counterparty,
        as: 'client',
        attributes: ['id', 'shortName', 'fullName', 'nip', 'regon', 'street', 'postalCode', 'city', 'country'],
        required: false,
      },
      {
        model: DocumentItem,
        as: 'items',
      },
    ],
    order: [[{ model: DocumentItem, as: 'items' }, 'sortOrder', 'ASC']],
    transaction,
  });

  if (!document) {
    throw new AppError(404, 'Document not found');
  }

  const doc = document.get({ plain: true });
  const client = doc.client || {};
  const rawItems = Array.isArray(doc.items) ? doc.items : [];

  const company = await Company.findByPk(companyId, {
    attributes: ['id', 'name', 'nip', 'regon', 'street', 'postalCode', 'city', 'country'],
    transaction,
  });
  const companyData = company ? company.get({ plain: true }) : {};

  const docType = String(doc.type || '').toUpperCase();
  const typeLabel = getDocTypeLabel(docType);
  const typeKey = getDocTypeKey(docType);

  const items = rawItems.map((item, idx) => ({
    lp: idx + 1,
    id: safeStr(item.id),
    name: safeStr(item.name),
    description: safeStr(item.comment),
    sku: safeStr(item.sku),
    ean: safeStr(item.ean),
    pkwiu: safeStr(item.pkwiu),
    gtu: safeStr(item.gtu),
    quantity: safeNum(item.quantity),
    unit: safeStr(item.unit) || 'szt',
    unitNetPrice: safeNum(item.unitNet),
    unitGross: safeNum(item.unitGross),
    vatRate: safeNum(item.vatRate),
    netAmount: safeNum(item.sumNet),
    vatAmount: safeNum(item.sumVat),
    grossAmount: safeNum(item.sumGross),
    discountPercent: safeNum(item.discountPercent, 0),
    discountValue: safeNum(item.discountValue, 0),
  }));

  const byVatRate = computeByVatRate(rawItems);

  return {
    company: {
      id: safeStr(companyData.id),
      legalName: safeStr(companyData.name),
      name: safeStr(companyData.name),
      nip: safeStr(companyData.nip),
      regon: safeStr(companyData.regon),
      addressLine1: safeStr(companyData.street),
      postalCode: safeStr(companyData.postalCode),
      city: safeStr(companyData.city),
      country: safeStr(companyData.country),
      bankAccount: null,
      bankName: null,
      email: null,
      phone: null,
    },
    counterparty: {
      id: safeStr(client.id),
      legalName: safeStr(client.fullName || client.shortName),
      name: safeStr(client.shortName || client.fullName),
      nip: safeStr(client.nip),
      regon: safeStr(client.regon),
      addressLine1: safeStr(client.street),
      postalCode: safeStr(client.postalCode),
      city: safeStr(client.city),
      country: safeStr(client.country),
      email: null,
      phone: null,
    },
    documentType: {
      key: typeKey,
      displayName: typeLabel,
    },
    document: {
      id: safeStr(doc.id),
      number: safeStr(doc.number),
      type: safeStr(doc.type),
      typeLabel,
      issueDate: safeDate(doc.issueDate),
      saleDate: safeDate(doc.saleDate || doc.issueDate),
      dueDate: safeDate(doc.paymentDueDate),
      currency: safeStr(doc.currency) || 'PLN',
      notes: safeStr(doc.notes),
      privateNotes: safeStr(doc.internalNotes),
      status: safeStr(doc.status),
      ksefNumber: null,
      ksefDate: null,
    },
    payment: {
      method: safeStr(doc.paymentMethod),
      methodLabel: getPaymentMethodLabel(doc.paymentMethod),
      dueDate: safeDate(doc.paymentDueDate),
      daysNet: doc.paymentDays != null ? safeNum(doc.paymentDays) : null,
      bankAccount: null,
      bankName: null,
      status: safeStr(doc.paymentStatus),
      paid: safeNum(doc.paidAmount, 0),
      outstanding: safeNum(doc.remainingAmount, 0),
    },
    totals: {
      net: safeNum(doc.totalNet, 0),
      vat: safeNum(doc.totalVat, 0),
      gross: safeNum(doc.totalGross, 0),
      discount: safeNum(doc.totalDiscount, 0),
      currency: safeStr(doc.currency) || 'PLN',
      byVatRate,
      grossInWords: null,
    },
    items,
    warehouse: {},
    shipment: {},
    signatures: {},
    user: {},
    computed: {},
  };
}

module.exports = { buildRenderContextForDocument };
