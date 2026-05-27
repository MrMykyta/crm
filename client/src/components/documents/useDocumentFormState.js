import { useCallback, useMemo, useState } from "react";
import {
  createDefaultDocumentFormValues,
  createDefaultDocumentItem,
  createDefaultDocumentPayment,
  DOCUMENT_DIRECTIONS,
  DOCUMENT_TYPES,
} from "./documentDefaults";
import { getDocumentTypeConfig } from "./documentTypeConfig";
import {
  isDocumentStatusAllowed,
  normalizeDocumentStatus,
  isPaymentEnabledForType,
  isPaymentStatusAllowed,
  resolvePaymentStatus,
} from "./documentStatusConfig";

const NUMERIC_ITEM_FIELDS = new Set(["quantity", "unitNet", "vatRate"]);
const NUMERIC_PAYMENT_FIELDS = new Set(["paidAmount"]);

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function toNumber(value) {
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function createRow(seed = {}) {
  const defaultItem = createDefaultDocumentItem(seed);
  return {
    localId: createLocalId(),
    name: normalizeText(defaultItem.name),
    quantity: toNumber(defaultItem.quantity),
    unit: normalizeText(defaultItem.unit),
    unitNet: toNumber(defaultItem.unitNet),
    vatRate: toNumber(defaultItem.vatRate),
  };
}

function normalizeHeader(seed = {}) {
  const defaultForm = createDefaultDocumentFormValues();
  const type = normalizeText(seed.type, defaultForm.header.type).toUpperCase();
  const direction = normalizeText(seed.direction, defaultForm.header.direction).toLowerCase();
  const normalizedType = DOCUMENT_TYPES.includes(type) ? type : defaultForm.header.type;
  return {
    type: normalizedType,
    direction: DOCUMENT_DIRECTIONS.includes(direction) ? direction : defaultForm.header.direction,
    status: normalizeDocumentStatus(normalizedType, seed.status ?? defaultForm.header.status),
    number: normalizeText(seed.number),
  };
}

function normalizeMeta(seed = {}) {
  const defaultForm = createDefaultDocumentFormValues();
  return {
    clientId: normalizeText(seed.clientId),
    issueDate: normalizeText(seed.issueDate, defaultForm.meta.issueDate),
  };
}

function normalizeDateInput(value) {
  const text = normalizeText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function normalizeIntegerInput(value) {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Math.trunc(n);
}

function normalizeTerms(seed = {}) {
  const defaultForm = createDefaultDocumentFormValues();
  return {
    validFrom: normalizeDateInput(seed.validFrom ?? defaultForm.terms.validFrom),
    validTo: normalizeDateInput(seed.validTo ?? defaultForm.terms.validTo),
    validDays: normalizeIntegerInput(seed.validDays ?? defaultForm.terms.validDays),
    paymentDueDate: normalizeDateInput(seed.paymentDueDate ?? defaultForm.terms.paymentDueDate),
    paymentDays: normalizeIntegerInput(seed.paymentDays ?? defaultForm.terms.paymentDays),
  };
}

function normalizeSource(seed = {}) {
  const defaultForm = createDefaultDocumentFormValues();
  return {
    sourceEntityType: normalizeNullableText(seed?.sourceEntityType ?? defaultForm.source.sourceEntityType),
    sourceEntityId: normalizeNullableText(seed?.sourceEntityId ?? defaultForm.source.sourceEntityId),
    sourceDocumentType: normalizeNullableText(seed?.sourceDocumentType ?? defaultForm.source.sourceDocumentType),
    sourceDocumentId: normalizeNullableText(seed?.sourceDocumentId ?? defaultForm.source.sourceDocumentId),
  };
}

function normalizeContent(seed = {}) {
  const defaultForm = createDefaultDocumentFormValues();
  return {
    notes: normalizeText(seed?.notes, defaultForm.content.notes),
  };
}

function normalizePayment(seed = {}, type, totalGross = 0) {
  const defaultPayment = createDefaultDocumentPayment();
  const supportsPayment = isPaymentEnabledForType(type);
  const normalizedTotalGross = round(Math.max(toNumber(totalGross), 0), 2);

  if (!supportsPayment) {
    return {
      paymentStatus: null,
      paidAmount: 0,
      remainingAmount: normalizedTotalGross,
      paymentDate: "",
      paymentMethod: "",
    };
  }

  const rawPaidAmount = toNumber(seed?.paidAmount ?? defaultPayment.paidAmount);
  const paidAmount = round(Math.min(Math.max(rawPaidAmount, 0), normalizedTotalGross), 2);
  const paymentStatus = resolvePaymentStatus(type, paidAmount, normalizedTotalGross);
  const remainingAmount = round(Math.max(normalizedTotalGross - paidAmount, 0), 2);

  return {
    paymentStatus,
    paidAmount,
    remainingAmount,
    paymentDate: normalizeDateInput(seed?.paymentDate ?? defaultPayment.paymentDate),
    paymentMethod: normalizeText(seed?.paymentMethod ?? defaultPayment.paymentMethod),
  };
}

function isFilledItem(item) {
  return Boolean(normalizeText(item?.name));
}

function normalizeInitialValue(initialValue) {
  if (!initialValue || typeof initialValue !== "object" || Array.isArray(initialValue)) {
    return {};
  }
  return initialValue;
}

export default function useDocumentFormState(initialValue = {}) {
  const safeInitialValue = normalizeInitialValue(initialValue);
  const defaultForm = createDefaultDocumentFormValues();
  const [header, setHeader] = useState(() => normalizeHeader(safeInitialValue.header));
  const [meta, setMeta] = useState(() => normalizeMeta(safeInitialValue.meta));
  const [terms, setTerms] = useState(() => normalizeTerms(safeInitialValue.terms));
  const [source, setSource] = useState(() => normalizeSource(safeInitialValue.source));
  const [content, setContent] = useState(() => normalizeContent(safeInitialValue.content));
  const [items, setItems] = useState(() => {
    const source = Array.isArray(safeInitialValue.items) ? safeInitialValue.items : [];
    if (!source.length) return [createRow(defaultForm.items[0])];
    return source.map((item) => createRow(item));
  });
  const [paymentDraft, setPaymentDraft] = useState(() =>
    normalizePayment(safeInitialValue.payment, normalizeHeader(safeInitialValue.header).type, 0)
  );

  const calculatedItems = useMemo(
    () =>
      items.map((item, index) => {
        const quantity = toNumber(item.quantity);
        const unitNet = toNumber(item.unitNet);
        const vatRate = toNumber(item.vatRate);
        const sumNet = round(quantity * unitNet, 2);
        const sumVat = round(sumNet * (vatRate / 100), 2);
        const sumGross = round(sumNet + sumVat, 2);

        return {
          ...item,
          sortOrder: index,
          quantity,
          unitNet,
          vatRate,
          sumNet,
          sumVat,
          sumGross,
        };
      }),
    [items]
  );

  const preparedItems = useMemo(
    () => calculatedItems.filter((item) => isFilledItem(item)),
    [calculatedItems]
  );

  const totals = useMemo(() => {
    const totalNet = round(preparedItems.reduce((acc, item) => acc + item.sumNet, 0), 2);
    const totalVat = round(preparedItems.reduce((acc, item) => acc + item.sumVat, 0), 2);
    const totalGross = round(preparedItems.reduce((acc, item) => acc + item.sumGross, 0), 2);
    return { totalNet, totalVat, totalGross };
  }, [preparedItems]);

  const payment = useMemo(
    () => normalizePayment(paymentDraft, header.type, totals.totalGross),
    [header.type, paymentDraft, totals.totalGross]
  );

  const handleHeaderChange = useCallback((nextValue) => {
    setHeader((prev) => {
      const raw = typeof nextValue === "function" ? nextValue(prev) : nextValue;
      return normalizeHeader(raw);
    });
  }, []);

  const handleItemChange = useCallback((localId, field, value) => {
    const nextValue = NUMERIC_ITEM_FIELDS.has(field) ? toNumber(value) : value;
    setItems((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row;
        return { ...row, [field]: nextValue };
      })
    );
  }, []);

  const handleAddRow = useCallback(() => {
    setItems((prev) => [...prev, createRow()]);
  }, []);

  const handleRemoveRow = useCallback((localId) => {
    setItems((prev) => {
      const next = prev.filter((row) => row.localId !== localId);
      return next.length ? next : [createRow()];
    });
  }, []);

  const handlePaymentChange = useCallback((field, value) => {
    const nextValue = NUMERIC_PAYMENT_FIELDS.has(field) ? toNumber(value) : value;
    setPaymentDraft((prev) => ({
      ...prev,
      [field]: nextValue,
    }));
  }, []);

  const validate = useCallback(() => {
    if (!DOCUMENT_TYPES.includes(header.type)) return "Выберите тип документа";
    if (!DOCUMENT_DIRECTIONS.includes(header.direction)) return "Выберите направление документа";
    if (!isDocumentStatusAllowed(header.type, header.status)) return "Выберите корректный статус документа";
    if (!meta.issueDate) return "Укажите дату выставления";
    if (header.direction === "sale" && !meta.clientId) return "Для документа продажи укажите клиента";

    const typeConfig = getDocumentTypeConfig(header.type);

    if (!preparedItems.length && typeConfig.capabilities.requiresItems) {
      return "Добавьте хотя бы одну позицию";
    }

    if (typeConfig.sections.validity) {
      if (terms.validDays !== "" && terms.validDays <= 0) {
        return "Срок действия в днях должен быть больше 0";
      }
      if (terms.validFrom && terms.validTo && terms.validFrom > terms.validTo) {
        return "Дата окончания не может быть раньше даты начала";
      }
    }

    if (typeConfig.sections.paymentTerms) {
      if (terms.paymentDays !== "" && terms.paymentDays <= 0) {
        return "Срок оплаты в днях должен быть больше 0";
      }
      if (terms.paymentDueDate && meta.issueDate && terms.paymentDueDate < meta.issueDate) {
        return "Дата оплаты не может быть раньше даты документа";
      }
    }

    if (typeConfig.capabilities.supportsPayment) {
      if (payment.paidAmount < 0) {
        return "Сумма оплаты не может быть отрицательной";
      }
      if (payment.paidAmount > totals.totalGross) {
        return "Сумма оплаты не может превышать итоговую сумму документа";
      }
      if (payment.paymentStatus && !isPaymentStatusAllowed(header.type, payment.paymentStatus)) {
        return "Выберите корректный статус оплаты";
      }
    }

    for (let i = 0; i < preparedItems.length; i += 1) {
      const item = preparedItems[i];
      if (!normalizeText(item.name)) return `Позиция ${i + 1}: укажите наименование`;
      if (item.quantity <= 0) return `Позиция ${i + 1}: количество должно быть больше 0`;
      if (item.unitNet < 0) return `Позиция ${i + 1}: цена без НДС не может быть отрицательной`;
      if (item.vatRate < 0) return `Позиция ${i + 1}: ставка НДС не может быть отрицательной`;
    }

    return "";
  }, [header.direction, header.status, header.type, meta.clientId, meta.issueDate, payment, preparedItems, terms, totals.totalGross]);

  const hydrate = useCallback((nextValue = {}) => {
    const nextHeader = normalizeHeader(nextValue.header);
    setHeader(nextHeader);
    setMeta(normalizeMeta(nextValue.meta));
    setTerms(normalizeTerms(nextValue.terms));
    setSource(normalizeSource(nextValue.source));
    setContent(normalizeContent(nextValue.content));
    const sourceItems = Array.isArray(nextValue.items) ? nextValue.items : [];
    const fallback = createDefaultDocumentFormValues().items[0];
    const normalizedItems = sourceItems.length ? sourceItems.map((item) => createRow(item)) : [createRow(fallback)];
    setItems(normalizedItems);
    const hydratedTotalGross = round(
      normalizedItems.reduce((acc, item) => {
        const quantity = toNumber(item.quantity);
        const unitNet = toNumber(item.unitNet);
        const vatRate = toNumber(item.vatRate);
        const sumNet = round(quantity * unitNet, 2);
        const sumVat = round(sumNet * (vatRate / 100), 2);
        const sumGross = round(sumNet + sumVat, 2);
        return acc + sumGross;
      }, 0),
      2
    );
    setPaymentDraft(normalizePayment(nextValue.payment, nextHeader.type, hydratedTotalGross));
  }, []);

  const values = useMemo(
    () => ({
      header,
      meta,
      terms,
      source,
      content,
      payment,
      items: calculatedItems,
    }),
    [calculatedItems, content, header, meta, payment, source, terms]
  );

  return {
    header,
    setHeader: handleHeaderChange,
    meta,
    setMeta,
    terms,
    setTerms,
    source,
    setSource,
    content,
    setContent,
    payment,
    setPayment: handlePaymentChange,
    items: calculatedItems,
    totals,
    values,
    onItemChange: handleItemChange,
    onAddRow: handleAddRow,
    onRemoveRow: handleRemoveRow,
    validate,
    hydrate,
  };
}
