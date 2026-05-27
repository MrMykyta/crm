'use strict';

const { Op } = require('sequelize');
const { Document, DocumentItem, Counterparty } = require('../../models');
const AppError = require('../../errors/AppError');
const { isDocumentConversionAllowed } = require('./documentConversionConfig');
const { mapDocumentConversionDraft } = require('./documentConversionMapping');
const { assertDocumentTypeEnabled, generateNextDocumentNumber } = require('./documentNumberingService');
const {
  getCompanyInvoiceSettingsForUsage,
  resolveInvoiceAnnotation,
  resolveSourceDocumentAnnotation,
  shouldCreateWarehouseDocument,
} = require('./companyInvoiceSettingsService');
const {
  getCompanyWarehouseDocumentSettingsForUsage,
} = require('./companyWarehouseDocumentSettingsService');
const {
  DOCUMENT_TYPES,
  normalizeDocumentType,
  isSupportedDocumentType,
  getDefaultDocumentStatus,
  isDocumentStatusAllowed,
  isPaymentEnabledForType,
  isPaymentStatusAllowed,
  resolvePaymentStatus,
} = require('./documentStatusConfig');

const DIRECTIONS = new Set(['sale', 'purchase']);
const VALIDITY_TYPES = new Set(['QUOTE', 'ORDER']);
const PAYMENT_TERM_TYPES = new Set(['INVOICE', 'BILL']);
const LIST_SORT_FIELDS = new Set(['createdAt', 'issueDate', 'number', 'type', 'direction', 'status', 'totalGross']);
const ALLOWED_ITEM_FIELDS = new Set([
  'sortOrder',
  'productId',
  'name',
  'sku',
  'ean',
  'pkwiu',
  'cn',
  'gtu',
  'itemType',
  'quantity',
  'unit',
  'unitNet',
  'unitGross',
  'vatRate',
  'discountPercent',
  'discountValue',
  'sumNet',
  'sumVat',
  'sumGross',
  'warehouseId',
  'comment',
]);

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function asNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asOptionalText(value) {
  const normalized = asText(value);
  return normalized || null;
}

function asRequiredNumber(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    throw new AppError(400, `${fieldName} is required`);
  }
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    throw new AppError(400, `${fieldName} must be a number`);
  }
  return n;
}

function asDateOnly(value, fieldName) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, `${fieldName} is invalid`);
  }
  return parsed.toISOString().slice(0, 10);
}

function asOptionalDateOnly(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, `${fieldName} is invalid`);
  }
  return parsed.toISOString().slice(0, 10);
}

function asOptionalInt(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    throw new AppError(400, `${fieldName} must be a number`);
  }
  if (!Number.isInteger(n)) {
    throw new AppError(400, `${fieldName} must be an integer`);
  }
  return n;
}

function normalizeDocumentTerms({ payload = {}, existing, issueDate }) {
  const source = payload || {};
  const validFrom = hasOwn(source, 'validFrom')
    ? asOptionalDateOnly(source?.validFrom, 'validFrom')
    : asOptionalDateOnly(existing?.validFrom, 'validFrom');
  const validTo = hasOwn(source, 'validTo')
    ? asOptionalDateOnly(source?.validTo, 'validTo')
    : asOptionalDateOnly(existing?.validTo, 'validTo');
  const validDays = hasOwn(source, 'validDays')
    ? asOptionalInt(source?.validDays, 'validDays')
    : asOptionalInt(existing?.validDays, 'validDays');
  const paymentDueDate = hasOwn(source, 'paymentDueDate')
    ? asOptionalDateOnly(source?.paymentDueDate, 'paymentDueDate')
    : asOptionalDateOnly(existing?.paymentDueDate, 'paymentDueDate');
  const paymentDays = hasOwn(source, 'paymentDays')
    ? asOptionalInt(source?.paymentDays, 'paymentDays')
    : asOptionalInt(existing?.paymentDays, 'paymentDays');

  return {
    issueDate,
    validFrom,
    validTo,
    validDays,
    paymentDueDate,
    paymentDays,
  };
}

function applyTypeModeToTerms(type, terms = {}) {
  const normalized = { ...(terms || {}) };
  if (!VALIDITY_TYPES.has(type)) {
    normalized.validFrom = null;
    normalized.validTo = null;
    normalized.validDays = null;
  }
  if (!PAYMENT_TERM_TYPES.has(type)) {
    normalized.paymentDueDate = null;
    normalized.paymentDays = null;
  }
  return normalized;
}

function validateTermsByType({ type, issueDate, validFrom, validTo, validDays, paymentDueDate, paymentDays }) {
  if (VALIDITY_TYPES.has(type)) {
    if (validDays !== null && validDays <= 0) {
      throw new AppError(400, 'validDays must be greater than 0');
    }
    if (validFrom && validTo && validFrom > validTo) {
      throw new AppError(400, 'validTo cannot be earlier than validFrom');
    }
  }

  if (PAYMENT_TERM_TYPES.has(type)) {
    if (paymentDays !== null && paymentDays < 0) {
      throw new AppError(400, 'paymentDays must be non-negative');
    }
    if (paymentDueDate && issueDate && paymentDueDate < issueDate) {
      throw new AppError(400, 'paymentDueDate cannot be earlier than issueDate');
    }
  }
}

async function assertClientInCompany(clientId, companyId) {
  if (!clientId) return;
  const row = await Counterparty.findOne({
    where: { id: clientId, companyId },
    attributes: ['id'],
  });
  if (!row) {
    throw new AppError(400, 'clientId is invalid');
  }
}

function normalizeItems(rawItems) {
  if (rawItems === undefined || rawItems === null) return [];
  if (!Array.isArray(rawItems)) {
    throw new AppError(400, 'items must be an array');
  }

  return rawItems.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppError(400, `items[${index}] must be an object`);
    }

    const unknownFields = Object.keys(item).filter((field) => !ALLOWED_ITEM_FIELDS.has(field));
    if (unknownFields.length) {
      throw new AppError(400, `items[${index}] has unknown fields: ${unknownFields.join(', ')}`);
    }

    const name = String(item?.name || '').trim();
    if (!name) {
      throw new AppError(400, `items[${index}].name is required`);
    }

    const quantity = asRequiredNumber(item.quantity, `items[${index}].quantity`);
    if (quantity <= 0) {
      throw new AppError(400, `items[${index}].quantity must be greater than 0`);
    }

    const unitNet = asRequiredNumber(item.unitNet, `items[${index}].unitNet`);
    if (unitNet < 0) {
      throw new AppError(400, `items[${index}].unitNet must be non-negative`);
    }

    const vatRate = asRequiredNumber(item.vatRate, `items[${index}].vatRate`);
    if (vatRate < 0) {
      throw new AppError(400, `items[${index}].vatRate must be non-negative`);
    }

    const sumNet = round(quantity * unitNet, 2);
    const sumVat = round(sumNet * (vatRate / 100), 2);
    const sumGross = round(sumNet + sumVat, 2);
    const unitGross = quantity > 0 ? round(sumGross / quantity, 2) : 0;
    const rawSortOrder = item?.sortOrder ?? index;
    const sortOrder = Math.trunc(asNumber(rawSortOrder, index));

    return {
      sortOrder: sortOrder < 0 ? index : sortOrder,
      productId: item?.productId || null,
      name,
      sku: item?.sku || null,
      ean: item?.ean || null,
      pkwiu: item?.pkwiu || null,
      cn: item?.cn || null,
      gtu: item?.gtu || null,
      itemType: item?.itemType || 'custom',
      quantity,
      unit: String(item?.unit || 'szt').trim() || 'szt',
      unitNet,
      unitGross,
      vatRate,
      discountPercent: asNumber(item?.discountPercent, 0),
      discountValue: asNumber(item?.discountValue, 0),
      sumNet,
      sumVat,
      sumGross,
      warehouseId: item?.warehouseId || null,
      comment: item?.comment || null,
    };
  });
}

function buildTotals(items) {
  const totalNet = round(items.reduce((acc, item) => acc + asNumber(item.sumNet), 0), 2);
  const totalVat = round(items.reduce((acc, item) => acc + asNumber(item.sumVat), 0), 2);
  const totalGross = round(items.reduce((acc, item) => acc + asNumber(item.sumGross), 0), 2);
  return {
    totalNet,
    totalVat,
    totalGross,
    totalDiscount: 0,
  };
}

function parseListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || 1, 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit || 25, 10) || 25));

  const rawSort = String(query.sort || 'createdAt');
  const sort = LIST_SORT_FIELDS.has(rawSort) ? rawSort : 'createdAt';
  const dir = String(query.dir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
    dir,
  };
}

async function list({ query = {}, companyId }) {
  const { page, limit, offset, sort, dir } = parseListQuery(query);
  const where = { companyId };

  const search = asText(query.search || query.q);
  if (search) {
    where.number = { [Op.iLike]: `%${search}%` };
  }

  const type = asText(query.type).toUpperCase();
  if (type) {
    if (!DOCUMENT_TYPES.includes(type)) {
      throw new AppError(400, 'type filter is invalid');
    }
    where.type = type;
  }

  const direction = asText(query.direction).toLowerCase();
  if (direction) {
    if (!DIRECTIONS.has(direction)) {
      throw new AppError(400, 'direction filter is invalid');
    }
    where.direction = direction;
  }

  const clientId = asText(query.clientId);
  if (clientId) {
    where.clientId = clientId;
  }

  const { rows, count } = await Document.findAndCountAll({
    where,
    include: [
      {
        model: Counterparty,
        as: 'client',
        attributes: ['id', 'shortName', 'fullName'],
        required: false,
      },
    ],
    order: [[sort, dir]],
    limit,
    offset,
  });

  return {
    items: rows,
    total: count,
    page,
    limit,
  };
}

async function getById({ id, companyId }) {
  const document = await Document.findOne({
    where: { id, companyId },
    include: [
      {
        model: Counterparty,
        as: 'client',
        attributes: ['id', 'shortName', 'fullName'],
        required: false,
      },
      {
        model: DocumentItem,
        as: 'items',
      },
    ],
    order: [[{ model: DocumentItem, as: 'items' }, 'sortOrder', 'ASC']],
  });

  if (!document) {
    throw new AppError(404, 'Document not found');
  }

  return document;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeDocumentStatusByType(type, status) {
  const normalizedType = normalizeDocumentType(type);
  const fallbackStatus = getDefaultDocumentStatus(normalizedType);
  const normalizedStatus = asText(status).toLowerCase() || fallbackStatus;

  if (!isDocumentStatusAllowed(normalizedType, normalizedStatus)) {
    throw new AppError(400, `status "${normalizedStatus}" is invalid for type ${normalizedType}`);
  }

  return normalizedStatus;
}

function normalizePaymentState({ type, payload = {}, existing = null, totalGross = 0 }) {
  const normalizedType = normalizeDocumentType(type);
  const supportsPayment = isPaymentEnabledForType(normalizedType);
  const normalizedGross = round(Math.max(asNumber(totalGross, 0), 0), 2);

  if (!supportsPayment) {
    return {
      paymentStatus: null,
      paidAmount: 0,
      remainingAmount: normalizedGross,
      paymentDate: null,
      paymentMethod: null,
    };
  }

  const paidSource = hasOwn(payload, 'paidAmount') ? payload?.paidAmount : existing?.paidAmount;
  const paidAmount = round(asNumber(paidSource, 0), 2);
  if (paidAmount < 0) {
    throw new AppError(400, 'paidAmount must be non-negative');
  }
  if (paidAmount > normalizedGross) {
    throw new AppError(400, 'paidAmount cannot exceed totalGross');
  }

  if (hasOwn(payload, 'paymentStatus')) {
    const submittedPaymentStatus = asText(payload?.paymentStatus).toLowerCase();
    if (submittedPaymentStatus && !isPaymentStatusAllowed(normalizedType, submittedPaymentStatus)) {
      throw new AppError(400, `paymentStatus "${submittedPaymentStatus}" is invalid for type ${normalizedType}`);
    }
  }

  const paymentDate = hasOwn(payload, 'paymentDate')
    ? asOptionalDateOnly(payload?.paymentDate, 'paymentDate')
    : asOptionalDateOnly(existing?.paymentDate, 'paymentDate');
  const paymentMethod = hasOwn(payload, 'paymentMethod')
    ? asOptionalText(payload?.paymentMethod)
    : asOptionalText(existing?.paymentMethod);
  const paymentStatus = resolvePaymentStatus(normalizedType, paidAmount, normalizedGross);
  const remainingAmount = round(normalizedGross - paidAmount, 2);

  return {
    paymentStatus,
    paidAmount,
    remainingAmount,
    paymentDate,
    paymentMethod,
  };
}

async function create({ payload, user }) {
  const companyId = user?.companyId;
  const userId = user?.id || null;

  if (!companyId) {
    throw new AppError(403, 'Company context required');
  }

  const type = normalizeDocumentType(payload?.type);
  if (!isSupportedDocumentType(type)) {
    throw new AppError(400, 'type is required and must be one of QUOTE, ORDER, INVOICE, BILL, RECEIPT, CONTRACT');
  }

  const direction = String(payload?.direction || '').trim().toLowerCase();
  if (!DIRECTIONS.has(direction)) {
    throw new AppError(400, 'direction is required and must be sale or purchase');
  }

  const clientId = payload?.clientId || null;
  if (direction === 'sale' && !clientId) {
    throw new AppError(400, 'clientId is required for sale documents');
  }
  await assertClientInCompany(clientId, companyId);

  let invoiceSettings = null;
  let normalizedPayload = { ...(payload || {}) };
  if (type === 'INVOICE') {
    invoiceSettings = await getCompanyInvoiceSettingsForUsage({ companyId });
    const sourceDocumentAnnotation = await resolveSourceDocumentAnnotation({
      companyId,
      sourceDocumentId: normalizedPayload?.sourceDocumentId,
    });
    const preferSettingsOverIncoming = Boolean(normalizedPayload?.sourceDocumentId);
    const annotation = resolveInvoiceAnnotation({
      invoiceSettings,
      incomingAnnotation: normalizedPayload?.notes,
      sourceDocumentAnnotation,
      preferSettingsOverIncoming,
    });

    normalizedPayload = {
      ...normalizedPayload,
      paymentMethod: hasOwn(normalizedPayload, 'paymentMethod')
        ? normalizedPayload?.paymentMethod
        : invoiceSettings.invoiceDefaultPaymentMethod,
      paymentDays: hasOwn(normalizedPayload, 'paymentDays')
        ? normalizedPayload?.paymentDays
        : invoiceSettings.invoiceDefaultPaymentTermDays,
      currency: hasOwn(normalizedPayload, 'currency')
        ? normalizedPayload?.currency
        : invoiceSettings.invoiceDefaultCurrency,
      notes: annotation,
    };
  }

  const items = normalizeItems(normalizedPayload?.items);
  if (type !== 'CONTRACT' && items.length === 0) {
    throw new AppError(400, 'items are required');
  }

  const issueDate = asDateOnly(normalizedPayload?.issueDate, 'issueDate');
  const manualNumber = asText(normalizedPayload?.number) || null;
  const terms = applyTypeModeToTerms(type, normalizeDocumentTerms({ payload: normalizedPayload, issueDate }));
  validateTermsByType({ type, ...terms });
  const status = normalizeDocumentStatusByType(type, normalizedPayload?.status);

  const totals = buildTotals(items);
  const payment = normalizePaymentState({
    type,
    payload: normalizedPayload,
    existing: null,
    totalGross: totals.totalGross,
  });

  const tx = await Document.sequelize.transaction();
  try {
    await assertDocumentTypeEnabled({
      companyId,
      documentType: type,
      transaction: tx,
    });

    const generatedNumber = manualNumber
      ? null
      : await generateNextDocumentNumber({
        companyId,
        documentType: type,
        issueDate: terms.issueDate,
        transaction: tx,
      });
    const resolvedNumber = manualNumber || generatedNumber || null;

    const created = await Document.create(
      {
        companyId,
        type,
        direction,
        status,
        number: resolvedNumber,
        clientId,
        contactId: normalizedPayload?.contactId || null,
        issueDate: terms.issueDate,
        validFrom: terms.validFrom,
        validTo: terms.validTo,
        validDays: terms.validDays,
        paymentDueDate: terms.paymentDueDate,
        paymentDays: terms.paymentDays,
        paymentStatus: payment.paymentStatus,
        paidAmount: payment.paidAmount,
        remainingAmount: payment.remainingAmount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        currency: normalizedPayload?.currency || 'PLN',
        language: normalizedPayload?.language || 'pl',
        template: normalizedPayload?.template || null,
        notes: normalizedPayload?.notes || null,
        internalNotes: normalizedPayload?.internalNotes || null,
        sourceEntityType: normalizedPayload?.sourceEntityType || null,
        sourceEntityId: normalizedPayload?.sourceEntityId || null,
        sourceDocumentId: normalizedPayload?.sourceDocumentId || null,
        sourceDocumentType: normalizedPayload?.sourceDocumentType || null,
        relatedDealId: normalizedPayload?.relatedDealId || null,
        warehouseId: normalizedPayload?.warehouseId || null,
        ownerId: normalizedPayload?.ownerId || userId,
        createdBy: userId,
        updatedBy: userId,
        ...totals,
      },
      { transaction: tx }
    );

    if (items.length) {
      await DocumentItem.bulkCreate(
        items.map((item) => ({
          ...item,
          documentId: created.id,
        })),
        { transaction: tx }
      );
    }

    if (type === 'INVOICE' && invoiceSettings && shouldCreateWarehouseDocument(invoiceSettings)) {
      const warehouseSettings = await getCompanyWarehouseDocumentSettingsForUsage({
        companyId,
        transaction: tx,
      });
      if (warehouseSettings?.warehouseDefaultNumberingSourceType) {
        // TODO(invoice-stock-update): create warehouse issue document when invoice stock mode is enabled
        // using warehouseSettings.warehouseDefaultNumberingSourceType.
      }
    }

    await tx.commit();
    return getById({ id: created.id, companyId });
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function update({ id, payload, user }) {
  const companyId = user?.companyId;
  const userId = user?.id || null;

  if (!companyId) {
    throw new AppError(403, 'Company context required');
  }

  const existing = await Document.findOne({
    where: { id, companyId },
  });

  if (!existing) {
    throw new AppError(404, 'Document not found');
  }

  const type = normalizeDocumentType(payload?.type ?? existing.type);
  if (!isSupportedDocumentType(type)) {
    throw new AppError(400, 'type is required and must be one of QUOTE, ORDER, INVOICE, BILL, RECEIPT, CONTRACT');
  }

  const direction = String(payload?.direction ?? existing.direction ?? '').trim().toLowerCase();
  if (!DIRECTIONS.has(direction)) {
    throw new AppError(400, 'direction is required and must be sale or purchase');
  }

  const clientId = hasOwn(payload, 'clientId') ? (payload?.clientId || null) : (existing.clientId || null);
  if (direction === 'sale' && !clientId) {
    throw new AppError(400, 'clientId is required for sale documents');
  }
  await assertClientInCompany(clientId, companyId);

  const hasItemsInPayload = hasOwn(payload, 'items');
  const items = hasItemsInPayload ? normalizeItems(payload?.items) : null;
  if (hasItemsInPayload && type !== 'CONTRACT' && items.length === 0) {
    throw new AppError(400, 'items are required');
  }
  if (!hasItemsInPayload && type !== 'CONTRACT') {
    const existingItemsCount = await DocumentItem.count({ where: { documentId: existing.id } });
    if (existingItemsCount === 0) {
      throw new AppError(400, 'items are required');
    }
  }

  const totals = hasItemsInPayload
    ? buildTotals(items)
    : {
      totalNet: asNumber(existing.totalNet, 0),
      totalVat: asNumber(existing.totalVat, 0),
      totalGross: asNumber(existing.totalGross, 0),
      totalDiscount: asNumber(existing.totalDiscount, 0),
    };
  const issueDate = asDateOnly(hasOwn(payload, 'issueDate') ? payload?.issueDate : existing.issueDate, 'issueDate');
  const terms = applyTypeModeToTerms(
    type,
    normalizeDocumentTerms({
      payload,
      existing,
      issueDate,
    })
  );
  validateTermsByType({ type, ...terms });
  const status = normalizeDocumentStatusByType(type, hasOwn(payload, 'status') ? payload?.status : existing.status);
  const payment = normalizePaymentState({
    type,
    payload,
    existing,
    totalGross: totals.totalGross,
  });

  const tx = await Document.sequelize.transaction();
  try {
    await existing.update(
      {
        type,
        direction,
        status,
        number: hasOwn(payload, 'number') ? (payload?.number || null) : existing.number,
        clientId,
        contactId: hasOwn(payload, 'contactId') ? (payload?.contactId || null) : existing.contactId,
        issueDate: terms.issueDate,
        validFrom: terms.validFrom,
        validTo: terms.validTo,
        validDays: terms.validDays,
        paymentDueDate: terms.paymentDueDate,
        paymentDays: terms.paymentDays,
        paymentStatus: payment.paymentStatus,
        paidAmount: payment.paidAmount,
        remainingAmount: payment.remainingAmount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        currency: hasOwn(payload, 'currency') ? (payload?.currency || 'PLN') : (existing.currency || 'PLN'),
        language: hasOwn(payload, 'language') ? (payload?.language || 'pl') : (existing.language || 'pl'),
        template: hasOwn(payload, 'template') ? (payload?.template || null) : existing.template,
        notes: hasOwn(payload, 'notes') ? (payload?.notes || null) : existing.notes,
        internalNotes: hasOwn(payload, 'internalNotes') ? (payload?.internalNotes || null) : existing.internalNotes,
        sourceEntityId: hasOwn(payload, 'sourceEntityId')
          ? (payload?.sourceEntityId || null)
          : existing.sourceEntityId,
        sourceEntityType: hasOwn(payload, 'sourceEntityType')
          ? (payload?.sourceEntityType || null)
          : existing.sourceEntityType,
        sourceDocumentId: hasOwn(payload, 'sourceDocumentId')
          ? (payload?.sourceDocumentId || null)
          : existing.sourceDocumentId,
        sourceDocumentType: hasOwn(payload, 'sourceDocumentType')
          ? (payload?.sourceDocumentType || null)
          : existing.sourceDocumentType,
        relatedDealId: hasOwn(payload, 'relatedDealId')
          ? (payload?.relatedDealId || null)
          : existing.relatedDealId,
        warehouseId: hasOwn(payload, 'warehouseId') ? (payload?.warehouseId || null) : existing.warehouseId,
        ownerId: hasOwn(payload, 'ownerId') ? (payload?.ownerId || null) : existing.ownerId,
        updatedBy: userId,
        ...totals,
      },
      { transaction: tx }
    );

    if (hasItemsInPayload) {
      await DocumentItem.destroy({
        where: { documentId: existing.id },
        transaction: tx,
      });

      if (items.length) {
        await DocumentItem.bulkCreate(
          items.map((item) => ({
            ...item,
            documentId: existing.id,
          })),
          { transaction: tx }
        );
      }
    }

    await tx.commit();
    return getById({ id: existing.id, companyId });
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function convert({ id, payload, user }) {
  const companyId = user?.companyId;
  if (!companyId) {
    throw new AppError(403, 'Company context required');
  }

  const targetType = String(payload?.targetType || '').trim().toUpperCase();
  if (!targetType) {
    throw new AppError(400, 'targetType is required');
  }

  const sourceDocument = await getById({ id, companyId });
  const sourceType = String(sourceDocument?.type || '').trim().toUpperCase();

  if (!isDocumentConversionAllowed(sourceType, targetType)) {
    throw new AppError(400, `Conversion ${sourceType} -> ${targetType} is not allowed`);
  }

  const conversionDraft = mapDocumentConversionDraft(sourceDocument, targetType);
  return create({
    payload: conversionDraft,
    user,
  });
}

module.exports = {
  list,
  create,
  getById,
  update,
  convert,
};
