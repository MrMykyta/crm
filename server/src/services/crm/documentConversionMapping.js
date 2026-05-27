'use strict';

const { getDefaultDocumentStatus } = require('./documentStatusConfig');

const VALIDITY_TYPES = new Set(['QUOTE', 'ORDER']);
const PAYMENT_TERM_TYPES = new Set(['INVOICE', 'BILL']);

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNullable(value) {
  const text = asText(value);
  return text || null;
}

function asNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asDateOnlyOrNull(value) {
  const text = asText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function mapTermsForTarget(sourceDocument, targetType) {
  const target = asText(targetType).toUpperCase();
  const supportsValidity = VALIDITY_TYPES.has(target);
  const supportsPaymentTerms = PAYMENT_TERM_TYPES.has(target);

  return {
    validFrom: supportsValidity ? asDateOnlyOrNull(sourceDocument?.validFrom) : null,
    validTo: supportsValidity ? asDateOnlyOrNull(sourceDocument?.validTo) : null,
    validDays: supportsValidity ? asNumberOrNull(sourceDocument?.validDays) : null,
    paymentDueDate: supportsPaymentTerms ? asDateOnlyOrNull(sourceDocument?.paymentDueDate) : null,
    paymentDays: supportsPaymentTerms ? asNumberOrNull(sourceDocument?.paymentDays) : null,
  };
}

function mapItems(sourceDocument) {
  const sourceItems = Array.isArray(sourceDocument?.items) ? sourceDocument.items : [];
  const sorted = [...sourceItems].sort((left, right) => {
    const a = Number.isFinite(Number(left?.sortOrder)) ? Number(left.sortOrder) : 0;
    const b = Number.isFinite(Number(right?.sortOrder)) ? Number(right.sortOrder) : 0;
    return a - b;
  });

  return sorted.map((item, index) => ({
    sortOrder: index,
    productId: asNullable(item?.productId),
    name: asText(item?.name),
    sku: asNullable(item?.sku),
    ean: asNullable(item?.ean),
    pkwiu: asNullable(item?.pkwiu),
    cn: asNullable(item?.cn),
    gtu: asNullable(item?.gtu),
    itemType: asText(item?.itemType) || 'custom',
    quantity: Number(item?.quantity ?? 0),
    unit: asText(item?.unit) || 'szt',
    unitNet: Number(item?.unitNet ?? 0),
    vatRate: Number(item?.vatRate ?? 0),
    discountPercent: Number(item?.discountPercent ?? 0),
    discountValue: Number(item?.discountValue ?? 0),
    warehouseId: asNullable(item?.warehouseId),
    comment: asNullable(item?.comment),
  }));
}

function mapDocumentConversionDraft(sourceDocument, targetType) {
  const normalizedTargetType = asText(targetType).toUpperCase();
  const terms = mapTermsForTarget(sourceDocument, normalizedTargetType);

  return {
    type: normalizedTargetType,
    direction: asText(sourceDocument?.direction).toLowerCase() || 'sale',
    status: getDefaultDocumentStatus(normalizedTargetType),
    number: null,
    clientId: asNullable(sourceDocument?.clientId),
    contactId: asNullable(sourceDocument?.contactId),
    issueDate: getTodayDate(),
    ...terms,
    currency: asText(sourceDocument?.currency) || 'PLN',
    language: asText(sourceDocument?.language) || 'pl',
    template: asNullable(sourceDocument?.template),
    notes: asNullable(sourceDocument?.notes),
    internalNotes: asNullable(sourceDocument?.internalNotes),
    paymentStatus: null,
    paidAmount: 0,
    remainingAmount: null,
    paymentDate: null,
    paymentMethod: null,
    sourceEntityType: asNullable(sourceDocument?.sourceEntityType),
    sourceEntityId: asNullable(sourceDocument?.sourceEntityId),
    sourceDocumentType: asText(sourceDocument?.type).toUpperCase() || null,
    sourceDocumentId: asNullable(sourceDocument?.id),
    relatedDealId: asNullable(sourceDocument?.relatedDealId),
    warehouseId: asNullable(sourceDocument?.warehouseId),
    ownerId: asNullable(sourceDocument?.ownerId),
    items: mapItems(sourceDocument),
  };
}

module.exports = {
  mapDocumentConversionDraft,
};
