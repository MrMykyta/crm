import { DOCUMENT_TYPES } from "./documentTypeConfig";

export const DOCUMENT_STATUS_CONFIG = Object.freeze({
  QUOTE: Object.freeze([
    Object.freeze({ key: "draft", label: "Черновик" }),
    Object.freeze({ key: "active", label: "Активно" }),
    Object.freeze({ key: "sent", label: "Отправлено" }),
    Object.freeze({ key: "accepted", label: "Принято" }),
    Object.freeze({ key: "rejected", label: "Отклонено" }),
    Object.freeze({ key: "expired", label: "Просрочено" }),
  ]),
  ORDER: Object.freeze([
    Object.freeze({ key: "draft", label: "Черновик" }),
    Object.freeze({ key: "pending", label: "Ожидает" }),
    Object.freeze({ key: "confirmed", label: "Подтверждён" }),
    Object.freeze({ key: "in_progress", label: "В работе" }),
    Object.freeze({ key: "completed", label: "Завершён" }),
    Object.freeze({ key: "canceled", label: "Отменён" }),
  ]),
  INVOICE: Object.freeze([
    Object.freeze({ key: "draft", label: "Черновик" }),
    Object.freeze({ key: "issued", label: "Выставлен" }),
    Object.freeze({ key: "sent", label: "Отправлен" }),
    Object.freeze({ key: "partially_paid", label: "Частично оплачен" }),
    Object.freeze({ key: "paid", label: "Оплачен" }),
    Object.freeze({ key: "overdue", label: "Просрочен" }),
    Object.freeze({ key: "canceled", label: "Отменён" }),
  ]),
  BILL: Object.freeze([
    Object.freeze({ key: "draft", label: "Черновик" }),
    Object.freeze({ key: "issued", label: "Выставлен" }),
    Object.freeze({ key: "sent", label: "Отправлен" }),
    Object.freeze({ key: "partially_paid", label: "Частично оплачен" }),
    Object.freeze({ key: "paid", label: "Оплачен" }),
    Object.freeze({ key: "overdue", label: "Просрочен" }),
    Object.freeze({ key: "canceled", label: "Отменён" }),
  ]),
  RECEIPT: Object.freeze([
    Object.freeze({ key: "draft", label: "Черновик" }),
    Object.freeze({ key: "issued", label: "Выдан" }),
    Object.freeze({ key: "paid", label: "Оплачен" }),
    Object.freeze({ key: "canceled", label: "Отменён" }),
  ]),
  CONTRACT: Object.freeze([
    Object.freeze({ key: "draft", label: "Черновик" }),
    Object.freeze({ key: "active", label: "Активен" }),
    Object.freeze({ key: "signed", label: "Подписан" }),
    Object.freeze({ key: "terminated", label: "Расторгнут" }),
    Object.freeze({ key: "archived", label: "Архивирован" }),
  ]),
});

export const PAYMENT_STATUS_CONFIG = Object.freeze({
  INVOICE: Object.freeze([
    Object.freeze({ key: "unpaid", label: "Не оплачен" }),
    Object.freeze({ key: "partially_paid", label: "Частично оплачен" }),
    Object.freeze({ key: "paid", label: "Оплачен" }),
  ]),
  BILL: Object.freeze([
    Object.freeze({ key: "unpaid", label: "Не оплачен" }),
    Object.freeze({ key: "partially_paid", label: "Частично оплачен" }),
    Object.freeze({ key: "paid", label: "Оплачен" }),
  ]),
  RECEIPT: Object.freeze([
    Object.freeze({ key: "unpaid", label: "Не оплачен" }),
    Object.freeze({ key: "partially_paid", label: "Частично оплачен" }),
    Object.freeze({ key: "paid", label: "Оплачен" }),
  ]),
});

export const PAYMENT_METHOD_OPTIONS = Object.freeze([
  Object.freeze({ value: "bank_transfer", label: "Банковский перевод" }),
  Object.freeze({ value: "cash", label: "Наличные" }),
  Object.freeze({ value: "card", label: "Карта" }),
  Object.freeze({ value: "other", label: "Другое" }),
]);

function normalizeType(type) {
  const normalized = String(type || "").trim().toUpperCase();
  return DOCUMENT_TYPES.includes(normalized) ? normalized : DOCUMENT_TYPES[0];
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export function getDocumentStatusEntries(type) {
  return DOCUMENT_STATUS_CONFIG[normalizeType(type)] || [];
}

export function getDocumentStatusOptions(type) {
  return getDocumentStatusEntries(type).map((entry) => ({
    value: entry.key,
    label: entry.label,
  }));
}

export function getDefaultDocumentStatus(type) {
  const first = getDocumentStatusEntries(type)[0];
  return first?.key || "draft";
}

export function isDocumentStatusAllowed(type, status) {
  const normalizedStatus = normalizeStatus(status);
  if (!normalizedStatus) return false;
  return getDocumentStatusEntries(type).some((entry) => entry.key === normalizedStatus);
}

export function normalizeDocumentStatus(type, status) {
  const fallback = getDefaultDocumentStatus(type);
  const normalizedStatus = normalizeStatus(status) || fallback;
  return isDocumentStatusAllowed(type, normalizedStatus) ? normalizedStatus : fallback;
}

export function getDocumentStatusLabel(type, status) {
  const normalizedStatus = normalizeStatus(status);
  if (!normalizedStatus) return "—";
  const match = getDocumentStatusEntries(type).find((entry) => entry.key === normalizedStatus);
  return match?.label || normalizedStatus;
}

export function getPaymentStatusEntries(type) {
  return PAYMENT_STATUS_CONFIG[normalizeType(type)] || [];
}

export function isPaymentEnabledForType(type) {
  return getPaymentStatusEntries(type).length > 0;
}

export function getPaymentStatusOptions(type) {
  return getPaymentStatusEntries(type).map((entry) => ({
    value: entry.key,
    label: entry.label,
  }));
}

export function isPaymentStatusAllowed(type, paymentStatus) {
  const normalizedStatus = normalizeStatus(paymentStatus);
  if (!normalizedStatus) return false;
  return getPaymentStatusEntries(type).some((entry) => entry.key === normalizedStatus);
}

export function resolvePaymentStatus(type, paidAmount, totalGross) {
  if (!isPaymentEnabledForType(type)) return null;

  const paid = Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : 0;
  const gross = Number.isFinite(Number(totalGross)) ? Number(totalGross) : 0;

  if (paid <= 0) return "unpaid";
  if (paid >= gross) return "paid";
  return "partially_paid";
}

export function getPaymentStatusLabel(type, paymentStatus) {
  const normalizedStatus = normalizeStatus(paymentStatus);
  if (!normalizedStatus) return "—";
  const match = getPaymentStatusEntries(type).find((entry) => entry.key === normalizedStatus);
  return match?.label || normalizedStatus;
}
