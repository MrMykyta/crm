import {
  createDefaultDocumentFormValues,
  createDefaultDocumentItem,
  createDefaultDocumentPayment,
  DOCUMENT_DIRECTIONS,
  DOCUMENT_TYPES,
  getTodayDate,
} from "./documentDefaults";
import { getDocumentTypeConfig } from "./documentTypeConfig";
import {
  normalizeDocumentStatus,
  isPaymentEnabledForType,
  resolvePaymentStatus,
} from "./documentStatusConfig";

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function asText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeIssueDate(value) {
  const text = asText(value);
  if (!text) return getTodayDate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return getTodayDate();
  return parsed.toISOString().slice(0, 10);
}

function normalizeOptionalDate(value) {
  const text = asText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function toIntegerOrEmpty(value) {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Math.trunc(n);
}

function toIntegerOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function mapItemToForm(item) {
  const defaultItem = createDefaultDocumentItem();
  return {
    name: asText(item?.name),
    quantity: toNumber(item?.quantity, defaultItem.quantity),
    unit: asText(item?.unit, defaultItem.unit),
    unitNet: toNumber(item?.unitNet, defaultItem.unitNet),
    vatRate: toNumber(item?.vatRate, defaultItem.vatRate),
  };
}

function mapSourceToForm(source = {}) {
  const defaultForm = createDefaultDocumentFormValues();
  return {
    sourceEntityType: asText(source?.sourceEntityType || source?.source_entity_type) || defaultForm.source.sourceEntityType,
    sourceEntityId: asText(source?.sourceEntityId || source?.source_entity_id) || defaultForm.source.sourceEntityId,
    sourceDocumentType:
      asText(source?.sourceDocumentType || source?.source_document_type) || defaultForm.source.sourceDocumentType,
    sourceDocumentId: asText(source?.sourceDocumentId || source?.source_document_id) || defaultForm.source.sourceDocumentId,
  };
}

function mapTermsToForm(terms = {}) {
  const defaultForm = createDefaultDocumentFormValues();
  return {
    validFrom: normalizeOptionalDate(terms?.validFrom || terms?.valid_from || defaultForm.terms.validFrom),
    validTo: normalizeOptionalDate(terms?.validTo || terms?.valid_to || defaultForm.terms.validTo),
    validDays: toIntegerOrEmpty(terms?.validDays ?? terms?.valid_days ?? defaultForm.terms.validDays),
    paymentDueDate: normalizeOptionalDate(
      terms?.paymentDueDate || terms?.payment_due_date || defaultForm.terms.paymentDueDate
    ),
    paymentDays: toIntegerOrEmpty(terms?.paymentDays ?? terms?.payment_days ?? defaultForm.terms.paymentDays),
  };
}

function mapPaymentToForm(payment = {}, type, totalGross = 0) {
  const defaultPayment = createDefaultDocumentPayment();
  const supportsPayment = isPaymentEnabledForType(type);

  if (!supportsPayment) {
    return {
      paymentStatus: null,
      paidAmount: 0,
      remainingAmount: round(Math.max(toNumber(totalGross, 0), 0), 2),
      paymentDate: "",
      paymentMethod: "",
    };
  }

  const normalizedTotalGross = round(Math.max(toNumber(totalGross, 0), 0), 2);
  const paidAmount = round(Math.max(toNumber(payment?.paidAmount, defaultPayment.paidAmount), 0), 2);
  const boundedPaidAmount = Math.min(paidAmount, normalizedTotalGross);
  const remainingAmount = round(Math.max(normalizedTotalGross - boundedPaidAmount, 0), 2);
  const paymentStatus = resolvePaymentStatus(type, boundedPaidAmount, normalizedTotalGross);

  return {
    paymentStatus,
    paidAmount: boundedPaidAmount,
    remainingAmount,
    paymentDate: normalizeOptionalDate(payment?.paymentDate || payment?.payment_date || defaultPayment.paymentDate),
    paymentMethod: asText(payment?.paymentMethod || payment?.payment_method || defaultPayment.paymentMethod),
  };
}

function hasItemContent(item) {
  return Boolean(asText(item?.name));
}

export function mapDocumentToFormState(document) {
  const defaultForm = createDefaultDocumentFormValues();
  const type = asText(document?.type, defaultForm.header.type).toUpperCase();
  const direction = asText(document?.direction, defaultForm.header.direction).toLowerCase();
  const normalizedType = DOCUMENT_TYPES.includes(type) ? type : defaultForm.header.type;
  const rawItems = Array.isArray(document?.items) ? document.items : [];
  const sortedItems = [...rawItems].sort((a, b) => {
    const left = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : 0;
    const right = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : 0;
    return left - right;
  });
  const totalGross = toNumber(document?.totalGross, 0);

  return {
    header: {
      type: normalizedType,
      direction: DOCUMENT_DIRECTIONS.includes(direction) ? direction : defaultForm.header.direction,
      status: normalizeDocumentStatus(normalizedType, document?.status),
      number: asText(document?.number),
    },
    meta: {
      clientId: asText(document?.clientId),
      issueDate: normalizeIssueDate(document?.issueDate || defaultForm.meta.issueDate),
    },
    terms: mapTermsToForm(document),
    source: mapSourceToForm(document),
    content: {
      notes: asText(document?.notes),
    },
    payment: mapPaymentToForm(document, normalizedType, totalGross),
    items: sortedItems.map((item) => mapItemToForm(item)),
  };
}

export function buildDocumentPayload(formStateValues = {}) {
  const defaultForm = createDefaultDocumentFormValues();
  const defaultItem = createDefaultDocumentItem();
  const defaultPayment = createDefaultDocumentPayment();
  const header = formStateValues?.header || {};
  const meta = formStateValues?.meta || {};
  const terms = formStateValues?.terms || {};
  const source = formStateValues?.source || {};
  const content = formStateValues?.content || {};
  const payment = formStateValues?.payment || {};
  const rawItems = Array.isArray(formStateValues?.items) ? formStateValues.items : [];
  const preparedItems = rawItems.filter((item) => hasItemContent(item)).map((item, index) => ({
    sortOrder: index,
    name: asText(item?.name),
    quantity: toNumber(item?.quantity, defaultItem.quantity),
    unit: asText(item?.unit, defaultItem.unit),
    unitNet: toNumber(item?.unitNet, defaultItem.unitNet),
    vatRate: toNumber(item?.vatRate, defaultItem.vatRate),
  }));

  const type = asText(header?.type, defaultForm.header.type).toUpperCase();
  const normalizedType = DOCUMENT_TYPES.includes(type) ? type : defaultForm.header.type;
  const direction = asText(header?.direction, defaultForm.header.direction).toLowerCase();
  const normalizedSource = mapSourceToForm(source);
  const typeConfig = getDocumentTypeConfig(normalizedType);
  const supportsValidity = Boolean(typeConfig.sections.validity);
  const supportsPaymentTerms = Boolean(typeConfig.sections.paymentTerms);
  const supportsPayment = Boolean(typeConfig.capabilities.supportsPayment);
  const totalGross = round(preparedItems.reduce((acc, item) => acc + toNumber(item?.sumGross, 0), 0), 2);
  const paidAmount = supportsPayment
    ? round(Math.min(Math.max(toNumber(payment?.paidAmount, defaultPayment.paidAmount), 0), totalGross), 2)
    : 0;
  const remainingAmount = round(Math.max(totalGross - paidAmount, 0), 2);
  const paymentStatus = supportsPayment ? resolvePaymentStatus(normalizedType, paidAmount, totalGross) : null;

  return {
    type: normalizedType,
    direction: DOCUMENT_DIRECTIONS.includes(direction) ? direction : defaultForm.header.direction,
    status: normalizeDocumentStatus(normalizedType, header?.status),
    number: asText(header?.number) || null,
    clientId: asText(meta?.clientId) || null,
    issueDate: normalizeIssueDate(meta?.issueDate || defaultForm.meta.issueDate),
    validFrom: supportsValidity ? (normalizeOptionalDate(terms?.validFrom) || null) : null,
    validTo: supportsValidity ? (normalizeOptionalDate(terms?.validTo) || null) : null,
    validDays: supportsValidity ? toIntegerOrNull(terms?.validDays) : null,
    paymentDueDate: supportsPaymentTerms ? (normalizeOptionalDate(terms?.paymentDueDate) || null) : null,
    paymentDays: supportsPaymentTerms ? toIntegerOrNull(terms?.paymentDays) : null,
    notes: asText(content?.notes) || null,
    sourceEntityType: normalizedSource.sourceEntityType || null,
    sourceEntityId: normalizedSource.sourceEntityId || null,
    sourceDocumentType: normalizedSource.sourceDocumentType || null,
    sourceDocumentId: normalizedSource.sourceDocumentId || null,
    paymentStatus,
    paidAmount,
    remainingAmount,
    paymentDate: supportsPayment ? (normalizeOptionalDate(payment?.paymentDate) || null) : null,
    paymentMethod: supportsPayment ? (asText(payment?.paymentMethod) || null) : null,
    items: preparedItems,
  };
}
