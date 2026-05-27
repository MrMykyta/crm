'use strict';

const DOCUMENT_STATUS_CONFIG = Object.freeze({
  QUOTE: Object.freeze([
    Object.freeze({ key: 'draft', label: 'Черновик' }),
    Object.freeze({ key: 'active', label: 'Активно' }),
    Object.freeze({ key: 'sent', label: 'Отправлено' }),
    Object.freeze({ key: 'accepted', label: 'Принято' }),
    Object.freeze({ key: 'rejected', label: 'Отклонено' }),
    Object.freeze({ key: 'expired', label: 'Просрочено' }),
  ]),
  ORDER: Object.freeze([
    Object.freeze({ key: 'draft', label: 'Черновик' }),
    Object.freeze({ key: 'pending', label: 'Ожидает' }),
    Object.freeze({ key: 'confirmed', label: 'Подтверждён' }),
    Object.freeze({ key: 'in_progress', label: 'В работе' }),
    Object.freeze({ key: 'completed', label: 'Завершён' }),
    Object.freeze({ key: 'canceled', label: 'Отменён' }),
  ]),
  INVOICE: Object.freeze([
    Object.freeze({ key: 'draft', label: 'Черновик' }),
    Object.freeze({ key: 'issued', label: 'Выставлен' }),
    Object.freeze({ key: 'sent', label: 'Отправлен' }),
    Object.freeze({ key: 'partially_paid', label: 'Частично оплачен' }),
    Object.freeze({ key: 'paid', label: 'Оплачен' }),
    Object.freeze({ key: 'overdue', label: 'Просрочен' }),
    Object.freeze({ key: 'canceled', label: 'Отменён' }),
  ]),
  BILL: Object.freeze([
    Object.freeze({ key: 'draft', label: 'Черновик' }),
    Object.freeze({ key: 'issued', label: 'Выставлен' }),
    Object.freeze({ key: 'sent', label: 'Отправлен' }),
    Object.freeze({ key: 'partially_paid', label: 'Частично оплачен' }),
    Object.freeze({ key: 'paid', label: 'Оплачен' }),
    Object.freeze({ key: 'overdue', label: 'Просрочен' }),
    Object.freeze({ key: 'canceled', label: 'Отменён' }),
  ]),
  RECEIPT: Object.freeze([
    Object.freeze({ key: 'draft', label: 'Черновик' }),
    Object.freeze({ key: 'issued', label: 'Выдан' }),
    Object.freeze({ key: 'paid', label: 'Оплачен' }),
    Object.freeze({ key: 'canceled', label: 'Отменён' }),
  ]),
  CONTRACT: Object.freeze([
    Object.freeze({ key: 'draft', label: 'Черновик' }),
    Object.freeze({ key: 'active', label: 'Активен' }),
    Object.freeze({ key: 'signed', label: 'Подписан' }),
    Object.freeze({ key: 'terminated', label: 'Расторгнут' }),
    Object.freeze({ key: 'archived', label: 'Архивирован' }),
  ]),
});

const PAYMENT_STATUS_CONFIG = Object.freeze({
  INVOICE: Object.freeze([
    Object.freeze({ key: 'unpaid', label: 'Не оплачен' }),
    Object.freeze({ key: 'partially_paid', label: 'Частично оплачен' }),
    Object.freeze({ key: 'paid', label: 'Оплачен' }),
  ]),
  BILL: Object.freeze([
    Object.freeze({ key: 'unpaid', label: 'Не оплачен' }),
    Object.freeze({ key: 'partially_paid', label: 'Частично оплачен' }),
    Object.freeze({ key: 'paid', label: 'Оплачен' }),
  ]),
  RECEIPT: Object.freeze([
    Object.freeze({ key: 'unpaid', label: 'Не оплачен' }),
    Object.freeze({ key: 'partially_paid', label: 'Частично оплачен' }),
    Object.freeze({ key: 'paid', label: 'Оплачен' }),
  ]),
});

const DOCUMENT_TYPES = Object.freeze(Object.keys(DOCUMENT_STATUS_CONFIG));

function normalizeDocumentType(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeStatusKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isSupportedDocumentType(type) {
  return DOCUMENT_TYPES.includes(normalizeDocumentType(type));
}

function getAllowedDocumentStatuses(type) {
  const normalizedType = normalizeDocumentType(type);
  const statuses = DOCUMENT_STATUS_CONFIG[normalizedType] || [];
  return statuses.map((status) => status.key);
}

function getDefaultDocumentStatus(type) {
  const statuses = getAllowedDocumentStatuses(type);
  return statuses[0] || 'draft';
}

function isDocumentStatusAllowed(type, status) {
  const normalizedStatus = normalizeStatusKey(status);
  if (!normalizedStatus) return false;
  return getAllowedDocumentStatuses(type).includes(normalizedStatus);
}

function getAllowedPaymentStatuses(type) {
  const normalizedType = normalizeDocumentType(type);
  const statuses = PAYMENT_STATUS_CONFIG[normalizedType] || [];
  return statuses.map((status) => status.key);
}

function isPaymentEnabledForType(type) {
  return getAllowedPaymentStatuses(type).length > 0;
}

function isPaymentStatusAllowed(type, paymentStatus) {
  const normalizedStatus = normalizeStatusKey(paymentStatus);
  if (!normalizedStatus) return false;
  return getAllowedPaymentStatuses(type).includes(normalizedStatus);
}

function resolvePaymentStatus(type, paidAmount, totalGross) {
  if (!isPaymentEnabledForType(type)) {
    return null;
  }

  const paid = Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : 0;
  const gross = Number.isFinite(Number(totalGross)) ? Number(totalGross) : 0;

  if (paid <= 0) return 'unpaid';
  if (paid >= gross) return 'paid';
  return 'partially_paid';
}

module.exports = {
  DOCUMENT_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  DOCUMENT_TYPES,
  normalizeDocumentType,
  isSupportedDocumentType,
  getAllowedDocumentStatuses,
  getDefaultDocumentStatus,
  isDocumentStatusAllowed,
  getAllowedPaymentStatuses,
  isPaymentEnabledForType,
  isPaymentStatusAllowed,
  resolvePaymentStatus,
};
