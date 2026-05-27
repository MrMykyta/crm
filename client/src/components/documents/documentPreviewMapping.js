import { getDocumentTypeConfig } from "./documentTypeConfig";
import {
  getDocumentStatusLabel,
  getPaymentStatusLabel,
  isPaymentEnabledForType,
  resolvePaymentStatus,
} from "./documentStatusConfig";
import {
  mapBuyerToTemplateModel,
  mapCompanyToSellerTemplateModel,
} from "./documentTemplatePartiesMapping";

function asText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function toNumber(value, fallback = 0) {
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function buildAmountInWords(amount = 0) {
  const value = round(toNumber(amount, 0), 2).toFixed(2);
  return `${value} PLN`;
}

function getDirectionLabel(value) {
  const direction = String(value || "").trim().toLowerCase();
  if (direction === "purchase") return "Закупка";
  if (direction === "sale") return "Продажа";
  return "—";
}

function pickClientEntity(clientId, clients = []) {
  const normalizedId = asText(clientId);
  if (!normalizedId) return null;
  const list = Array.isArray(clients) ? clients : [];
  return list.find((client) => String(client?.id || "") === normalizedId) || null;
}

function pickClientLabel(clientId, clients = [], fallbackBuyer = null) {
  const normalizedId = asText(clientId);
  const match = pickClientEntity(normalizedId, clients) || fallbackBuyer;

  if (!match) {
    if (!normalizedId) return "Клиент не выбран";
    return `Клиент #${normalizedId.slice(0, 8)}`;
  }

  return asText(
    match.shortName || match.fullName || match.name || match.companyName || `${normalizedId.slice(0, 8)}`,
    "Контрагент"
  );
}

function normalizeItem(item = {}, index = 0) {
  const quantity = toNumber(item.quantity, 0);
  const additionalQuantity = toNumber(item.additionalQuantity, 0);
  const unitNet = toNumber(item.unitNet, 0);
  const unitGross = toNumber(item.unitGross, unitNet);
  const discount = toNumber(item.discount, 0);
  const vatRate = toNumber(item.vatRate, 0);
  const sumNet = round(toNumber(item.sumNet, quantity * unitNet), 2);
  const sumVat = round(toNumber(item.sumVat, sumNet * (vatRate / 100)), 2);
  const sumGross = round(toNumber(item.sumGross, sumNet + sumVat), 2);

  return {
    id: asText(item.localId || item.id || `item-${index + 1}`),
    lp: String(index + 1),
    name: asText(item.name),
    description: asText(item.description),
    sku: asText(item.sku),
    pkwiu: asText(item.pkwiu),
    quantity,
    unit: asText(item.unit, "szt"),
    additionalQuantity,
    additionalUnit: asText(item.additionalUnit),
    unitNet,
    unitGross,
    discount,
    vatRate,
    vatValue: sumVat,
    sumNet,
    sumVat,
    sumGross,
    rentalPeriod: asText(item.rentalPeriod),
  };
}

function buildTerms(typeConfig, terms = {}) {
  const entries = [];
  const map = {
    validFrom: "",
    validTo: "",
    validDays: "",
    paymentDueDate: "",
    paymentDays: "",
    text: "",
  };

  if (typeConfig.sections.validity) {
    const validFrom = asText(terms.validFrom);
    const validTo = asText(terms.validTo);
    const validDays = terms.validDays === "" ? "" : String(terms.validDays ?? "").trim();

    if (validFrom) entries.push({ label: "Действует с", value: validFrom });
    if (validTo) entries.push({ label: "Действует до", value: validTo });
    if (validDays) entries.push({ label: "Срок (дней)", value: validDays });
    map.validFrom = validFrom;
    map.validTo = validTo;
    map.validDays = validDays;
  }

  if (typeConfig.sections.paymentTerms) {
    const paymentDueDate = asText(terms.paymentDueDate);
    const paymentDays = terms.paymentDays === "" ? "" : String(terms.paymentDays ?? "").trim();

    if (paymentDueDate) entries.push({ label: "Оплатить до", value: paymentDueDate });
    if (paymentDays) entries.push({ label: "Срок оплаты (дней)", value: paymentDays });
    map.paymentDueDate = paymentDueDate;
    map.paymentDays = paymentDays;
  }

  const termsText = asText(terms.text);
  if (termsText) {
    entries.push({ label: "Warunki", value: termsText });
    map.text = termsText;
  }

  return { entries, map };
}

function buildSourceLabel(source = {}) {
  const sourceDocumentType = asText(source?.sourceDocumentType).toUpperCase();
  const sourceDocumentId = asText(source?.sourceDocumentId);
  const sourceEntityType = asText(source?.sourceEntityType);
  const sourceEntityId = asText(source?.sourceEntityId);

  if (sourceDocumentType || sourceDocumentId) {
    const sourceTypeLabel = sourceDocumentType
      ? getDocumentTypeConfig(sourceDocumentType).shortLabel
      : "Документ";
    const sourceIdLabel = sourceDocumentId ? sourceDocumentId.slice(0, 8) : "—";
    return `${sourceTypeLabel} ${sourceIdLabel}`;
  }

  if (sourceEntityType || sourceEntityId) {
    return [sourceEntityType || "Источник", sourceEntityId ? sourceEntityId.slice(0, 8) : "—"].join(" ");
  }

  return "";
}

function normalizeContext(context = {}) {
  if (Array.isArray(context)) {
    return {
      clients: context,
      company: null,
      buyer: null,
    };
  }

  if (!context || typeof context !== "object") {
    return {
      clients: [],
      company: null,
      buyer: null,
    };
  }

  return {
    clients: Array.isArray(context.clients) ? context.clients : [],
    company: context.company && typeof context.company === "object" ? context.company : null,
    buyer: context.buyer && typeof context.buyer === "object" ? context.buyer : null,
  };
}

export function mapFormStateToPreviewModel(formState, context = {}) {
  const { clients, company, buyer } = normalizeContext(context);
  const header = formState?.header || {};
  const meta = formState?.meta || {};
  const terms = formState?.terms || {};
  const totals = formState?.totals || {};
  const content = formState?.content || {};
  const source = formState?.source || {};
  const payment = formState?.payment || {};
  const typeConfig = getDocumentTypeConfig(header.type);
  const builtTerms = buildTerms(typeConfig, terms);

  const normalizedItems = (Array.isArray(formState?.items) ? formState.items : [])
    .map((item, index) => normalizeItem(item, index))
    .filter((item) => Boolean(item.name));

  const totalNet = round(toNumber(totals.totalNet, normalizedItems.reduce((acc, item) => acc + item.sumNet, 0)), 2);
  const totalVat = round(toNumber(totals.totalVat, normalizedItems.reduce((acc, item) => acc + item.sumVat, 0)), 2);
  const totalGross = round(
    toNumber(totals.totalGross, normalizedItems.reduce((acc, item) => acc + item.sumGross, 0)),
    2
  );
  const supportsPayment = isPaymentEnabledForType(header.type);
  const paidAmount = supportsPayment ? round(Math.min(Math.max(toNumber(payment?.paidAmount, 0), 0), totalGross), 2) : 0;
  const remainingAmount = round(Math.max(totalGross - paidAmount, 0), 2);
  const paymentStatus = supportsPayment ? resolvePaymentStatus(header.type, paidAmount, totalGross) : null;
  const selectedBuyer = buyer || pickClientEntity(meta.clientId, clients);
  const vatBreakdownMap = new Map();
  normalizedItems.forEach((item) => {
    const key = String(item.vatRate);
    const current = vatBreakdownMap.get(key) || 0;
    vatBreakdownMap.set(key, round(current + toNumber(item.vatValue, 0), 2));
  });
  const vatBreakdown = Array.from(vatBreakdownMap.entries()).map(([rate, vat]) => ({ rate, vat }));

  return {
    type: asText(header.type, "QUOTE"),
    typeLabel: typeConfig.label,
    title: typeConfig.label,
    direction: asText(header.direction, "sale"),
    directionLabel: getDirectionLabel(header.direction),
    status: asText(header.status),
    statusLabel: getDocumentStatusLabel(header.type, header.status),
    number: asText(header.number),
    issueDate: asText(meta.issueDate),
    saleDate: asText(meta.issueDate),
    deliveryDate: asText(meta.issueDate),
    originalCopyLabel: asText(header.originalCopyLabel, "ORYGINAŁ"),
    customerNumber: asText(meta.clientId).slice(0, 8),
    clientLabel: pickClientLabel(meta.clientId, clients, selectedBuyer),
    sourceLabel: buildSourceLabel(source),
    seller: mapCompanyToSellerTemplateModel(company || {}),
    buyer: mapBuyerToTemplateModel(selectedBuyer || {}),
    receiver: mapBuyerToTemplateModel(selectedBuyer || {}),
    payer: mapBuyerToTemplateModel(selectedBuyer || {}),
    contactPerson: asText(content.contactPerson || selectedBuyer?.contactPerson),
    items: normalizedItems,
    totals: {
      totalNet,
      totalVat,
      totalGross,
      amountDue: remainingAmount || totalGross,
      paidAmount,
      remainingAmount,
      amountInWords: buildAmountInWords(remainingAmount || totalGross),
      vatBreakdown,
    },
    terms: builtTerms.entries,
    termsMap: builtTerms.map,
    notes: asText(content.notes),
    internalNotes: asText(content.internalNotes),
    requiresItems: Boolean(typeConfig.capabilities.requiresItems),
    supportsPayment,
    payment: {
      paymentStatus,
      paymentStatusLabel: getPaymentStatusLabel(header.type, paymentStatus),
      paidAmount,
      remainingAmount,
      paymentDate: asText(payment?.paymentDate),
      paymentMethod: asText(payment?.paymentMethod),
      bank: asText(payment?.bank || company?.bank || company?.bankName),
      bankAccount: asText(payment?.bankAccount || company?.bankAccount),
    },
    footer: {
      generatedBy: "CRM",
      contacts: [company?.email, company?.phone, company?.website].filter(Boolean).join(" • "),
      marketing: asText(content.footerMarketing),
      pageNumber: "1/1",
    },
    termsText: asText(terms.text),
    termsHint: typeConfig.copy.sidebarHelper,
  };
}
