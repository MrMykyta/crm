import { DEFAULT_DOCUMENT_TYPE, DOCUMENT_TYPES } from "./documentTypeConfig";
import { getDefaultDocumentStatus } from "./documentStatusConfig";

export const DOCUMENT_DIRECTIONS = ["sale", "purchase"];
export { DOCUMENT_TYPES };

export const DEFAULT_DOCUMENT_FORM_VALUES = Object.freeze({
  header: Object.freeze({
    type: DEFAULT_DOCUMENT_TYPE,
    direction: "sale",
    status: getDefaultDocumentStatus(DEFAULT_DOCUMENT_TYPE),
    number: "",
  }),
  meta: Object.freeze({
    clientId: "",
    issueDate: "",
  }),
  terms: Object.freeze({
    validFrom: "",
    validTo: "",
    validDays: "",
    paymentDueDate: "",
    paymentDays: "",
  }),
  source: Object.freeze({
    sourceEntityType: null,
    sourceEntityId: null,
    sourceDocumentType: null,
    sourceDocumentId: null,
  }),
  content: Object.freeze({
    notes: "",
  }),
  payment: Object.freeze({
    paymentStatus: null,
    paidAmount: 0,
    remainingAmount: 0,
    paymentDate: "",
    paymentMethod: "",
  }),
});

export const DEFAULT_DOCUMENT_ITEM_VALUES = Object.freeze({
  name: "",
  quantity: 1,
  unit: "szt",
  unitNet: 0,
  vatRate: 23,
});

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createDefaultDocumentItem(overrides = {}) {
  return {
    ...DEFAULT_DOCUMENT_ITEM_VALUES,
    ...(overrides || {}),
  };
}

export function createDefaultDocumentSource(overrides = {}) {
  return {
    ...DEFAULT_DOCUMENT_FORM_VALUES.source,
    ...(overrides || {}),
  };
}

export function createDefaultDocumentPayment(overrides = {}) {
  return {
    ...DEFAULT_DOCUMENT_FORM_VALUES.payment,
    ...(overrides || {}),
  };
}

export function createDefaultDocumentFormValues(overrides = {}) {
  const next = overrides || {};
  return {
    header: {
      ...DEFAULT_DOCUMENT_FORM_VALUES.header,
      ...(next.header || {}),
    },
    meta: {
      ...DEFAULT_DOCUMENT_FORM_VALUES.meta,
      issueDate: getTodayDate(),
      ...(next.meta || {}),
    },
    terms: {
      ...DEFAULT_DOCUMENT_FORM_VALUES.terms,
      ...(next.terms || {}),
    },
    source: createDefaultDocumentSource(next.source),
    content: {
      ...DEFAULT_DOCUMENT_FORM_VALUES.content,
      ...(next.content || {}),
    },
    payment: createDefaultDocumentPayment(next.payment),
    items: Array.isArray(next.items) ? next.items : [createDefaultDocumentItem()],
  };
}
