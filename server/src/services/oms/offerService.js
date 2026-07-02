'use strict';

const crypto = require('crypto');
const { Op, fn, col, where: sqlWhere } = require('sequelize');
const AppError = require('../../errors/AppError');
const {
  sequelize,
  Offer,
  OfferItem,
  Order,
  OrderItem,
  Invoice,
  Counterparty,
  Contact,
  Deal,
  Product,
  Uom,
  TaxCategory,
  ProductType,
  User,
  UserCompany,
} = require('../../models');
const eventService = require('../system/eventService');
const invoiceService = require('./invoiceService');
const {
  assertDocumentTypeEnabled,
  generateNextDocumentNumber,
} = require('../crm/documentNumberingService');
const {
  getCompanyOrderSettings,
  resolveOrderAnnotation,
  shouldReserveProducts,
} = require('../crm/companyOrderSettingsService');
const {
  getCompanyOfferSettingsForUsage,
  resolveOfferAnnotation,
} = require('../crm/companyOfferSettingsService');
const { normalizeLineItemInput } = require('./lineItemNormalizer');

const OFFER_STATUSES = Object.freeze([
  'draft',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
]);

const DISCOUNT_TYPES = Object.freeze(['none', 'fixed', 'percent']);
const EDITABLE_STATUSES = new Set(['draft', 'sent', 'viewed']);
const TERMINAL_STATUSES = new Set(['accepted', 'rejected', 'expired', 'cancelled']);
const SORTABLE_FIELDS = new Set([
  'number',
  'status',
  'issueDate',
  'validUntil',
  'totalGross',
  'createdAt',
  'updatedAt',
]);

const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(['sent', 'cancelled']),
  sent: new Set(['viewed', 'accepted', 'rejected', 'expired', 'cancelled']),
  viewed: new Set(['accepted', 'rejected', 'expired', 'cancelled']),
  accepted: new Set([]),
  rejected: new Set([]),
  expired: new Set([]),
  cancelled: new Set([]),
});

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asOptionalText(value) {
  const text = asText(value);
  return text || null;
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asPositiveNumber(value, fieldName) {
  const parsed = asNumber(value, NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(400, `${fieldName} must be greater than 0`, { code: 'VALIDATION_ERROR' });
  }
  return parsed;
}

function asNonNegativeNumber(value, fieldName) {
  const parsed = asNumber(value, NaN);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(400, `${fieldName} must be non-negative`, { code: 'VALIDATION_ERROR' });
  }
  return parsed;
}

function round(value, scale = 4) {
  const factor = 10 ** scale;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function asDateOnly(value, fieldName, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(400, `${fieldName} is required`, { code: 'VALIDATION_ERROR' });
    }
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, `${fieldName} is invalid`, { code: 'VALIDATION_ERROR' });
  }
  return date.toISOString().slice(0, 10);
}

function parsePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || 1, 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit || 25, 10) || 25));
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function parseSort(query = {}) {
  const sortByRaw = asText(query.sortBy || query.sort || 'updatedAt');
  const fallbackField = 'updatedAt';

  let sortBy = sortByRaw;
  let sortOrder = asText(query.sortOrder || query.dir || 'DESC').toUpperCase();

  if (sortBy.includes(':')) {
    const [field, direction] = sortBy.split(':');
    sortBy = asText(field);
    sortOrder = asText(direction || sortOrder).toUpperCase();
  }

  const field = SORTABLE_FIELDS.has(sortBy) ? sortBy : fallbackField;
  const direction = sortOrder === 'ASC' ? 'ASC' : 'DESC';
  return [[field, direction]];
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
}

function normalizeStatusList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(list.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))];
}

function assertStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!OFFER_STATUSES.includes(normalized)) {
    throw new AppError(400, `Unsupported status "${status}"`, { code: 'VALIDATION_ERROR' });
  }
  return normalized;
}

function validateStatusTransition(currentStatus, nextStatus) {
  const current = assertStatus(currentStatus);
  const next = assertStatus(nextStatus);
  if (current === next) return next;

  const allowed = STATUS_TRANSITIONS[current] || new Set();
  if (!allowed.has(next)) {
    throw new AppError(409, `Invalid offer status transition: ${current} -> ${next}`, {
      code: 'INVALID_STATUS_TRANSITION',
      details: { currentStatus: current, nextStatus: next },
    });
  }
  return next;
}

function assertOfferEditable(offer) {
  const status = String(offer?.status || '').toLowerCase();
  if (!EDITABLE_STATUSES.has(status)) {
    throw new AppError(409, `Offer in status "${status}" is not editable`, {
      code: 'OFFER_NOT_EDITABLE',
    });
  }
}

function assertOfferConvertible(offer) {
  const status = String(offer?.status || '').toLowerCase();
  if (status !== 'accepted') {
    throw new AppError(409, 'Only accepted offer can be converted to order', {
      code: 'OFFER_NOT_CONVERTIBLE',
    });
  }
  if (offer?.convertedOrderId) {
    throw new AppError(409, 'Offer is already converted to order', {
      code: 'OFFER_ALREADY_CONVERTED',
    });
  }
}

function isNumberConstraintError(error, constraintName) {
  if (!error) return false;
  const msg = String(error?.message || '');
  const name = String(error?.name || '');
  const constraint = String(error?.original?.constraint || error?.parent?.constraint || '');
  return (
    name.includes('SequelizeUniqueConstraintError')
    && (
      constraint === constraintName
      || msg.includes(constraintName)
      || msg.includes('company_id')
    )
  );
}

function mapCounterpartySummary(counterparty) {
  if (!counterparty) return null;
  return {
    id: counterparty.id,
    name: counterparty.shortName || counterparty.fullName || null,
    shortName: counterparty.shortName || null,
    fullName: counterparty.fullName || null,
  };
}

function mapContactSummary(contact) {
  if (!contact) return null;
  return {
    id: contact.id,
    name: [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.displayName || null,
    email: contact.email || null,
  };
}

function mapUserSummary(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || null,
    email: user.email || null,
  };
}

function mapDealSummary(deal) {
  if (!deal) return null;
  return {
    id: deal.id,
    title: deal.title || null,
    status: deal.status || null,
  };
}

function mapOrderSummary(order) {
  if (!order) return null;
  const currencyCode = order.currencyCode || order.currency || null;
  return {
    id: order.id,
    number: order.number || null,
    status: order.status || null,
    totalGross: asNumber(order.totalGross, 0),
    currency: currencyCode,
    currencyCode,
    createdAt: order.createdAt || null,
  };
}

function mapInvoiceSummary(invoice, fallbackCurrencyCode = null) {
  if (!invoice) return null;
  return {
    id: invoice.id || null,
    number: invoice.number || null,
    status: invoice.status || null,
    invoiceType: invoice.invoiceType || null,
    totalGross: asNumber(invoice.totalGross, 0),
    currencyCode: invoice.currencyCode || fallbackCurrencyCode || null,
    issueDate: invoice.issueDate || null,
    createdAt: invoice.createdAt || null,
  };
}

function getAvailableActions(offer) {
  const status = String(offer?.status || '').toLowerCase();
  const isConverted = Boolean(offer?.convertedOrderId);
  const canEdit = EDITABLE_STATUSES.has(status) && !isConverted;

  return {
    canEdit,
    canDelete: status === 'draft' && !isConverted,
    canSend: status === 'draft',
    canView: status === 'sent',
    canAccept: status === 'sent' || status === 'viewed',
    canReject: status === 'sent' || status === 'viewed',
    canCancel: status === 'draft' || status === 'sent' || status === 'viewed',
    canExpire: status === 'sent' || status === 'viewed',
    canDuplicate: true,
    canConvertToOrder: status === 'accepted' && !isConverted,
  };
}

function mapOfferItemDto(item) {
  return {
    id: item.id,
    companyId: item.companyId,
    offerId: item.offerId,
    sortOrder: item.sortOrder,
    productId: item.productId || null,
    variantId: item.variantId || null,
    unitId: item.uomId || null,
    nameSnapshot: item.nameSnapshot || null,
    skuSnapshot: item.skuSnapshot || item.sku || null,
    descriptionSnapshot: item.descriptionSnapshot || null,
    unitSnapshot: item.unitSnapshot || null,
    vatRateSnapshot: asNumber(item.vatRateSnapshot ?? item.taxRate, 0),
    taxRate: asNumber(item.taxRate ?? item.vatRateSnapshot, 0),
    vatRate: asNumber(item.taxRate ?? item.vatRateSnapshot, 0),
    productTypeSnapshot: item.productTypeSnapshot || null,
    metadataSnapshot: item.metadataSnapshot || null,
    quantity: asNumber(item.qty, 0),
    unitPriceNet: asNumber(item.priceNet, 0),
    unitPriceGross: asNumber(item.priceGross, 0),
    discountType: item.discountType || 'none',
    discountValue: asNumber(item.discountValue, 0),
    discountAmount: asNumber(item.discountAmount, 0),
    lineSubtotalNet: asNumber(item.lineSubtotalNet, 0),
    lineVat: asNumber(item.lineVat, 0),
    lineTotalGross: asNumber(item.lineTotalGross, 0),
    isCustomLine: Boolean(item.isCustomLine),
    lineType: item.lineType || null,
    affectsInventory: Boolean(item.affectsInventory),
    isStockTrackedSnapshot: Boolean(item.isStockTrackedSnapshot),
    taxCategoryId: item.taxCategoryId || null,
    parentLineItemId: item.parentLineItemId || null,
    notes: item.notes || null,
    product: item.product
      ? {
        id: item.product.id,
        name: item.product.name || null,
        sku: item.product.sku || null,
      }
      : null,
    unit: item.unit
      ? {
        id: item.unit.id,
        code: item.unit.code || null,
        name: item.unit.name || null,
        symbol: item.unit.symbol || null,
      }
      : null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function mapOfferToListDto(offer) {
  return {
    id: offer.id,
    number: offer.number || null,
    status: offer.status,
    counterparty: mapCounterpartySummary(offer.counterparty || offer.customer),
    owner: mapUserSummary(offer.owner),
    issueDate: offer.issueDate || null,
    validUntil: offer.validUntil || null,
    totalGross: asNumber(offer.totalGross, 0),
    currency: offer.currency || null,
    itemsCount: Number(offer.itemsCount || 0),
    linesCount: Number(offer.linesCount || 0),
    convertedOrderId: offer.convertedOrderId || null,
    updatedAt: offer.updatedAt || null,
  };
}

function mapOfferToDetailDto(offer, related = {}) {
  const actions = getAvailableActions(offer);
  const statusMetadata = {
    status: offer.status,
    lastStatusChangedAt: offer.lastStatusChangedAt || null,
    sentAt: offer.sentAt || null,
    viewedAt: offer.viewedAt || null,
    acceptedAt: offer.acceptedAt || null,
    rejectedAt: offer.rejectedAt || null,
    cancelledAt: offer.cancelledAt || null,
    convertedAt: offer.convertedAt || null,
  };

  return {
    id: offer.id,
    companyId: offer.companyId,
    number: offer.number || null,
    status: offer.status,
    statusMetadata,
    title: offer.title || null,
    subject: offer.subject || null,
    issueDate: offer.issueDate || null,
    validUntil: offer.validUntil || null,
    currency: offer.currency || null,
    exchangeRate: offer.exchangeRate !== null ? asNumber(offer.exchangeRate, null) : null,
    sourceType: offer.sourceType || null,
    sourceId: offer.sourceId || null,
    counterpartyId: offer.counterpartyId || null,
    contactId: offer.contactId || null,
    ownerId: offer.ownerId || null,
    dealId: offer.dealId || null,
    subtotalNet: asNumber(offer.totalNet, 0),
    totalVat: asNumber(offer.totalTax, 0),
    totalGross: asNumber(offer.totalGross, 0),
    discountTotal: asNumber(offer.discountTotal, 0),
    roundingTotal: asNumber(offer.roundingTotal, 0),
    itemsCount: Number(offer.itemsCount || 0),
    linesCount: Number(offer.linesCount || 0),
    paymentTerms: offer.paymentTerms || null,
    deliveryTerms: offer.deliveryTerms || null,
    leadTime: offer.leadTime || null,
    incoterms: offer.incoterms || null,
    notes: offer.notes || null,
    internalNotes: offer.internalNotes || null,
    billingAddressSnapshot: offer.billingAddressSnapshot || null,
    shippingAddressSnapshot: offer.shippingAddressSnapshot || null,
    convertedOrderId: offer.convertedOrderId || null,
    convertedOrder: related.convertedOrder || mapOrderSummary(offer.convertedOrder),
    convertedInvoice: related.convertedInvoice || null,
    invoices: Array.isArray(related.invoices) ? related.invoices : [],
    createdBy: offer.createdBy || null,
    updatedBy: offer.updatedBy || null,
    createdByUser: mapUserSummary(offer.createdByUser),
    updatedByUser: mapUserSummary(offer.updatedByUser),
    owner: mapUserSummary(offer.owner),
    counterparty: mapCounterpartySummary(offer.counterparty || offer.customer),
    contact: mapContactSummary(offer.contact),
    deal: mapDealSummary(offer.deal),
    items: Array.isArray(offer.items) ? offer.items.map(mapOfferItemDto) : [],
    availableActions: actions,
    meta: offer.meta || {},
    createdAt: offer.createdAt || null,
    updatedAt: offer.updatedAt || null,
    deletedAt: offer.deletedAt || null,
  };
}

function hasInvoiceAttribute(field) {
  return Boolean(Invoice?.rawAttributes?.[field]);
}

function buildOfferInvoiceWhereClause({ companyId, offerId, convertedOrderId }) {
  const whereClause = { companyId };
  const or = [];

  if (convertedOrderId) {
    or.push({ orderId: convertedOrderId });
  }

  if (hasInvoiceAttribute('sourceId')) {
    if (hasInvoiceAttribute('sourceType')) {
      or.push({ sourceType: 'offer', sourceId: offerId });
    } else {
      or.push({ sourceId: offerId });
    }
  }

  if (hasInvoiceAttribute('sourceOfferId')) {
    or.push({ sourceOfferId: offerId });
  }

  if (!or.length) {
    return convertedOrderId ? { companyId, orderId: convertedOrderId } : { companyId, id: null };
  }

  return { ...whereClause, [Op.or]: or };
}

async function assertCounterpartyInCompany(counterpartyId, companyId, transaction) {
  if (!counterpartyId) {
    throw new AppError(400, 'counterpartyId is required', { code: 'VALIDATION_ERROR' });
  }
  const row = await Counterparty.findOne({
    where: { id: counterpartyId, companyId },
    attributes: ['id'],
    transaction,
  });
  if (!row) {
    throw new AppError(400, 'counterpartyId is invalid', { code: 'VALIDATION_ERROR' });
  }
}

async function assertContactInCompany(contactId, companyId, transaction) {
  if (!contactId) return;
  const row = await Contact.findOne({
    where: { id: contactId, companyId },
    attributes: ['id'],
    transaction,
  });
  if (!row) {
    throw new AppError(400, 'contactId is invalid', { code: 'VALIDATION_ERROR' });
  }
}

async function assertDealInCompany(dealId, companyId, transaction) {
  if (!dealId) return;
  const row = await Deal.findOne({
    where: { id: dealId, companyId },
    attributes: ['id'],
    transaction,
  });
  if (!row) {
    throw new AppError(400, 'dealId is invalid', { code: 'VALIDATION_ERROR' });
  }
}

async function assertOwnerInCompany(ownerId, companyId, transaction) {
  if (!ownerId) return;
  const row = await UserCompany.findOne({
    where: { userId: ownerId, companyId, status: 'active' },
    attributes: ['id'],
    transaction,
  });
  if (!row) {
    throw new AppError(400, 'ownerId is invalid', { code: 'VALIDATION_ERROR' });
  }
}

async function generateOfferNumber({ companyId, issueDate, transaction }) {
  await assertDocumentTypeEnabled({
    companyId,
    documentType: 'QUOTE',
    transaction,
  });
  return generateNextDocumentNumber({
    companyId,
    documentType: 'QUOTE',
    issueDate,
    transaction,
  });
}

async function generateOrderNumber({ companyId, issueDate, transaction }) {
  await assertDocumentTypeEnabled({
    companyId,
    documentType: 'ORDER',
    transaction,
  });
  return generateNextDocumentNumber({
    companyId,
    documentType: 'ORDER',
    issueDate,
    transaction,
  });
}

async function loadProductsMap({ companyId, productIds, transaction }) {
  if (!Array.isArray(productIds) || !productIds.length) return new Map();

  const rows = await Product.findAll({
    where: {
      id: { [Op.in]: productIds },
      companyId,
    },
    include: [
      { model: Uom, as: 'uom', attributes: ['id', 'code', 'name', 'symbol'], required: false },
      { model: TaxCategory, as: 'taxCategory', attributes: ['id', 'name', 'rate'], required: false },
      { model: ProductType, as: 'type', attributes: ['id', 'name', 'code'], required: false },
    ],
    transaction,
  });

  const map = new Map(rows.map((row) => [String(row.id), row]));
  for (const productId of productIds) {
    if (!map.has(String(productId))) {
      throw new AppError(400, `productId ${productId} is invalid`, { code: 'VALIDATION_ERROR' });
    }
  }
  return map;
}

function calculateOfferItemTotals(item) {
  const quantity = asPositiveNumber(item.quantity, 'quantity');
  const unitPriceNet = asNonNegativeNumber(item.unitPriceNet, 'unitPriceNet');
  const vatRate = asNonNegativeNumber(item.vatRateSnapshot, 'vatRate');
  const discountType = DISCOUNT_TYPES.includes(item.discountType) ? item.discountType : 'none';
  const discountValue = asNonNegativeNumber(item.discountValue, 'discountValue');

  const baseNet = round(quantity * unitPriceNet, 4);
  let discountAmount = 0;

  if (discountType === 'percent') {
    if (discountValue > 100) {
      throw new AppError(400, 'Percent discount must be between 0 and 100', {
        code: 'VALIDATION_ERROR',
      });
    }
    discountAmount = round((baseNet * discountValue) / 100, 4);
  } else if (discountType === 'fixed') {
    discountAmount = round(discountValue, 4);
    if (discountAmount > baseNet) {
      throw new AppError(400, 'Fixed discount cannot exceed line subtotal', {
        code: 'VALIDATION_ERROR',
      });
    }
  }

  const lineSubtotalNet = round(baseNet - discountAmount, 4);
  const lineVat = round((lineSubtotalNet * vatRate) / 100, 4);
  const lineTotalGross = round(lineSubtotalNet + lineVat, 4);
  const unitPriceGross = quantity > 0 ? round(lineTotalGross / quantity, 4) : 0;

  return {
    quantity,
    unitPriceNet,
    unitPriceGross,
    discountType,
    discountValue,
    discountAmount,
    lineSubtotalNet,
    lineVat,
    lineTotalGross,
    vatRate,
  };
}

function calculateOfferTotals(items = []) {
  const subtotalNet = round(items.reduce((acc, item) => acc + asNumber(item.lineSubtotalNet, 0), 0), 4);
  const totalVat = round(items.reduce((acc, item) => acc + asNumber(item.lineVat, 0), 0), 4);
  const totalGross = round(items.reduce((acc, item) => acc + asNumber(item.lineTotalGross, 0), 0), 4);
  const discountTotal = round(items.reduce((acc, item) => acc + asNumber(item.discountAmount, 0), 0), 4);

  return {
    subtotalNet,
    totalVat,
    totalGross,
    discountTotal,
    roundingTotal: 0,
    linesCount: items.length,
    itemsCount: items.length,
  };
}

function buildOfferItemSnapshots({ input, sourceProduct }) {
  const fromProduct = sourceProduct || null;
  const nameSnapshot = asOptionalText(input.nameSnapshot || input.name || fromProduct?.name);
  const skuSnapshot = asOptionalText(input.skuSnapshot || input.sku || fromProduct?.sku);
  const descriptionSnapshot = asOptionalText(
    input.descriptionSnapshot || input.description || fromProduct?.description
  );
  const unitSnapshot = asOptionalText(
    input.unitSnapshot || input.unit || fromProduct?.uom?.symbol || fromProduct?.uom?.code || fromProduct?.uom?.name
  );
  const vatRateSnapshot = asNumber(
    input.vatRateSnapshot ?? input.vatRate ?? input.taxRate ?? fromProduct?.taxCategory?.rate ?? 0,
    0
  );
  const productTypeSnapshot = asOptionalText(
    input.productTypeSnapshot || input.productType || fromProduct?.type?.code || fromProduct?.type?.name
  );
  const metadataSnapshot = input.metadataSnapshot && typeof input.metadataSnapshot === 'object'
    ? input.metadataSnapshot
    : null;

  return {
    nameSnapshot,
    skuSnapshot,
    descriptionSnapshot,
    unitSnapshot,
    vatRateSnapshot,
    productTypeSnapshot,
    metadataSnapshot,
  };
}

async function normalizeOfferItemInput({ input, index, companyId, transaction }) {
  const normalized = await normalizeLineItemInput(input, {
    companyId,
    transaction,
    mode: 'offer',
  });
  const productId = normalized.productId;

  if (!productId && !normalized.nameSnapshot) {
    throw new AppError(400, `items[${index}].nameSnapshot is required for custom line`, {
      code: 'VALIDATION_ERROR',
    });
  }

  const quantity = input.quantity ?? input.qty;
  const unitPriceNet = input.unitPriceNet ?? input.priceNet;
  const discountType = asText(input.discountType || 'none').toLowerCase() || 'none';
  const discountValue = input.discountValue ?? 0;
  const vatRateSnapshot = normalized.vatRateSnapshot;
  const calculated = calculateOfferItemTotals({
    quantity,
    unitPriceNet,
    vatRateSnapshot,
    discountType,
    discountValue,
  });

  const sortOrderRaw = input.sortOrder ?? index;
  const sortOrder = Number.isInteger(Number(sortOrderRaw)) ? Number(sortOrderRaw) : index;

  return {
    sortOrder: sortOrder < 0 ? index : sortOrder,
    productId: productId || null,
    variantId: normalized.variantId || null,
    unitId: normalized.unitId || null,
    skuSnapshot: normalized.skuSnapshot,
    nameSnapshot: normalized.nameSnapshot,
    descriptionSnapshot: normalized.descriptionSnapshot,
    unitSnapshot: normalized.unitSnapshot,
    vatRateSnapshot: normalized.vatRateSnapshot,
    productTypeSnapshot: normalized.productTypeSnapshot,
    metadataSnapshot: normalized.metadataSnapshot,
    lineType: normalized.lineType,
    affectsInventory: normalized.affectsInventory,
    isStockTrackedSnapshot: normalized.isStockTrackedSnapshot,
    taxCategoryId: normalized.taxCategoryId,
    parentLineItemId: normalized.parentLineItemId,
    ...calculated,
    isCustomLine: normalized.isCustomLine,
    notes: asOptionalText(input.notes),
  };
}

async function buildNormalizedItems({ itemsPayload, companyId, transaction }) {
  if (!Array.isArray(itemsPayload)) {
    throw new AppError(400, 'items must be an array', { code: 'VALIDATION_ERROR' });
  }

  const items = await Promise.all(itemsPayload.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppError(400, `items[${index}] must be an object`, { code: 'VALIDATION_ERROR' });
    }
    return normalizeOfferItemInput({
      input: item,
      index,
      companyId,
      transaction,
    });
  }));

  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

async function saveOfferItems({
  offer,
  itemsPayload,
  userContext,
  transaction,
}) {
  assertOfferEditable(offer);

  const normalizedItems = await buildNormalizedItems({
    itemsPayload,
    companyId: offer.companyId,
    transaction,
  });
  const totals = calculateOfferTotals(normalizedItems);

  await OfferItem.destroy({
    where: { offerId: offer.id, companyId: offer.companyId },
    transaction,
  });

  if (normalizedItems.length) {
    await OfferItem.bulkCreate(
      normalizedItems.map((item) => ({
        companyId: offer.companyId,
        offerId: offer.id,
        productId: item.productId,
        variantId: item.variantId,
        uomId: item.unitId,
        sortOrder: item.sortOrder,
        skuSnapshot: item.skuSnapshot,
        sku: item.skuSnapshot,
        nameSnapshot: item.nameSnapshot,
        descriptionSnapshot: item.descriptionSnapshot,
        unitSnapshot: item.unitSnapshot,
        vatRateSnapshot: item.vatRateSnapshot,
        productTypeSnapshot: item.productTypeSnapshot,
        metadataSnapshot: item.metadataSnapshot,
        qty: item.quantity,
        priceNet: item.unitPriceNet,
        priceGross: item.unitPriceGross,
        taxRate: item.vatRate,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount,
        lineSubtotalNet: item.lineSubtotalNet,
        lineVat: item.lineVat,
        lineTotalGross: item.lineTotalGross,
        isCustomLine: item.isCustomLine,
        lineType: item.lineType,
        affectsInventory: item.affectsInventory,
        isStockTrackedSnapshot: item.isStockTrackedSnapshot,
        taxCategoryId: item.taxCategoryId,
        parentLineItemId: item.parentLineItemId,
        notes: item.notes,
      })),
      { transaction }
    );
  }

  await offer.update({
    totalNet: totals.subtotalNet,
    totalTax: totals.totalVat,
    totalGross: totals.totalGross,
    discountTotal: totals.discountTotal,
    roundingTotal: totals.roundingTotal,
    linesCount: totals.linesCount,
    itemsCount: totals.itemsCount,
    updatedBy: userContext?.id || null,
  }, { transaction });

  return totals;
}

function buildListWhere({ query, companyId }) {
  const whereClause = { companyId };

  const statuses = normalizeStatusList(query.status);
  if (statuses.length) {
    statuses.forEach(assertStatus);
    whereClause.status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };
  }

  if (query.ownerId) whereClause.ownerId = query.ownerId;
  if (query.counterpartyId) whereClause.counterpartyId = query.counterpartyId;
  if (query.contactId) whereClause.contactId = query.contactId;
  if (query.dealId) whereClause.dealId = query.dealId;

  if (query.issueDateFrom || query.issueDateTo) {
    whereClause.issueDate = {};
    if (query.issueDateFrom) whereClause.issueDate[Op.gte] = asDateOnly(query.issueDateFrom, 'issueDateFrom');
    if (query.issueDateTo) whereClause.issueDate[Op.lte] = asDateOnly(query.issueDateTo, 'issueDateTo');
  }
  if (query.validUntilFrom || query.validUntilTo) {
    whereClause.validUntil = {};
    if (query.validUntilFrom) whereClause.validUntil[Op.gte] = asDateOnly(query.validUntilFrom, 'validUntilFrom');
    if (query.validUntilTo) whereClause.validUntil[Op.lte] = asDateOnly(query.validUntilTo, 'validUntilTo');
  }

  if (query.amountFrom || query.amountTo) {
    whereClause.totalGross = {};
    if (query.amountFrom !== undefined) whereClause.totalGross[Op.gte] = asNonNegativeNumber(query.amountFrom, 'amountFrom');
    if (query.amountTo !== undefined) whereClause.totalGross[Op.lte] = asNonNegativeNumber(query.amountTo, 'amountTo');
  }

  const converted = parseBoolean(query.converted);
  if (converted === true) whereClause.convertedOrderId = { [Op.ne]: null };
  if (converted === false) whereClause.convertedOrderId = null;

  const search = asText(query.search || query.q);
  if (search) {
    const like = `%${search}%`;
    whereClause[Op.or] = [
      { number: { [Op.iLike]: like } },
      { title: { [Op.iLike]: like } },
      { subject: { [Op.iLike]: like } },
      { notes: { [Op.iLike]: like } },
      { internalNotes: { [Op.iLike]: like } },
      { '$counterparty.short_name$': { [Op.iLike]: like } },
      { '$counterparty.full_name$': { [Op.iLike]: like } },
      { '$contact.first_name$': { [Op.iLike]: like } },
      { '$contact.last_name$': { [Op.iLike]: like } },
      sqlWhere(fn('concat', col('contact.first_name'), ' ', col('contact.last_name')), {
        [Op.iLike]: like,
      }),
    ];
  }

  return whereClause;
}

async function getOfferEntity({ id, companyId, transaction, includeItems = true }) {
  const include = [
    {
      model: Counterparty,
      as: 'counterparty',
      attributes: ['id', 'shortName', 'fullName'],
      required: false,
    },
    {
      model: Contact,
      as: 'contact',
      attributes: ['id', 'firstName', 'lastName', 'displayName', 'email'],
      required: false,
    },
    {
      model: User,
      as: 'owner',
      attributes: ['id', 'firstName', 'lastName', 'email'],
      required: false,
    },
    {
      model: Deal,
      as: 'deal',
      attributes: ['id', 'title', 'status'],
      required: false,
    },
    {
      model: Order,
      as: 'convertedOrder',
      attributes: ['id', 'number', 'status', 'currencyCode', 'totalGross', 'createdAt'],
      required: false,
    },
    {
      model: User,
      as: 'createdByUser',
      attributes: ['id', 'firstName', 'lastName', 'email'],
      required: false,
    },
    {
      model: User,
      as: 'updatedByUser',
      attributes: ['id', 'firstName', 'lastName', 'email'],
      required: false,
    },
  ];

  if (includeItems) {
    include.push({
      model: OfferItem,
      as: 'items',
      required: false,
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku'], required: false },
        { model: Uom, as: 'unit', attributes: ['id', 'code', 'name', 'symbol'], required: false },
      ],
    });
  }

  return Offer.findOne({
    where: { id, companyId },
    include,
    order: includeItems ? [[{ model: OfferItem, as: 'items' }, 'sortOrder', 'ASC']] : undefined,
    transaction,
  });
}

async function logOfferEvent({ companyId, type, offerId, userId, payload = {} }) {
  try {
    await eventService.create(
      companyId,
      type,
      { offerId, userId: userId || null, ...payload },
      { type: 'offer', id: offerId }
    );
  } catch (_error) {
    // timeline foundation is best-effort and must not break business transaction
  }
}

async function listOffers(query = {}, userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const { page, limit, offset } = parsePagination(query);
  const whereClause = buildListWhere({ query, companyId });
  const order = parseSort(query);

  const { rows, count } = await Offer.findAndCountAll({
    where: whereClause,
    include: [
      { model: Counterparty, as: 'counterparty', attributes: ['id', 'shortName', 'fullName'], required: false },
      { model: User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
      { model: Contact, as: 'contact', attributes: ['id', 'firstName', 'lastName'], required: false },
    ],
    order,
    limit,
    offset,
    subQuery: false,
    distinct: true,
  });

  return {
    items: rows.map(mapOfferToListDto),
    total: count,
    page,
    limit,
  };
}

async function getOfferById(id, userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const offer = await getOfferEntity({ id, companyId, includeItems: true });
  if (!offer) {
    throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
  }

  const convertedOrderSummary = mapOrderSummary(offer.convertedOrder);
  const convertedOrderId = offer.convertedOrderId || offer.convertedOrder?.id || null;
  const invoiceWhereClause = buildOfferInvoiceWhereClause({
    companyId,
    offerId: offer.id,
    convertedOrderId,
  });
  const invoiceRows = await Invoice.findAll({
    where: invoiceWhereClause,
    order: [['createdAt', 'ASC']],
  });

  const invoices = invoiceRows.map((invoice) => {
    const fallbackCurrency = convertedOrderSummary?.currencyCode || offer.currency || null;
    return mapInvoiceSummary(invoice, fallbackCurrency);
  });
  const convertedInvoice = invoices[0] || null;

  return mapOfferToDetailDto(offer, {
    convertedOrder: convertedOrderSummary,
    convertedInvoice,
    invoices,
  });
}

async function createOffer(payload = {}, userContext = {}, options = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const issueDate = asDateOnly(payload.issueDate || new Date(), 'issueDate', { required: true });
  const validUntil = asDateOnly(payload.validUntil, 'validUntil');
  if (validUntil && validUntil < issueDate) {
    throw new AppError(400, 'validUntil cannot be earlier than issueDate', { code: 'VALIDATION_ERROR' });
  }

  const counterpartyId = asOptionalText(payload.counterpartyId);
  const contactId = asOptionalText(payload.contactId);
  const ownerId = asOptionalText(payload.ownerId);
  const dealId = asOptionalText(payload.dealId);

  const externalTx = options?.transaction || userContext?.transaction || null;
  const tx = externalTx || await sequelize.transaction();
  const ownTransaction = !externalTx;
  let createdOfferId = null;
  try {
    await assertCounterpartyInCompany(counterpartyId, companyId, tx);
    await assertContactInCompany(contactId, companyId, tx);
    await assertOwnerInCompany(ownerId, companyId, tx);
    await assertDealInCompany(dealId, companyId, tx);

    const status = payload.status ? assertStatus(payload.status) : 'draft';
    const manualNumber = asOptionalText(payload.number);
    let number = manualNumber;
    if (!number) {
      number = await generateOfferNumber({ companyId, issueDate, transaction: tx });
    }
    const offerSettings = await getCompanyOfferSettingsForUsage({
      companyId,
      transaction: tx,
    });
    // TODO(offer-copy-from-documents): resolve source document annotation for offer creation/conversion flows.
    const sourceDocumentAnnotation = null;
    const resolvedAnnotation = resolveOfferAnnotation({
      offerSettings,
      incomingAnnotation: payload.notes,
      sourceDocumentAnnotation,
    });

    const itemsPayload = Array.isArray(payload.items) ? payload.items : [];
    const createdBy = userContext?.id || null;

    let offer = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        offer = await Offer.create({
          companyId,
          number,
          status,
          title: asOptionalText(payload.title),
          subject: asOptionalText(payload.subject),
          issueDate,
          validUntil,
          currency: asText(payload.currency || 'PLN').toUpperCase().slice(0, 3),
          exchangeRate: payload.exchangeRate !== undefined ? asNumber(payload.exchangeRate, null) : null,
          sourceType: asOptionalText(payload.sourceType) || 'manual',
          sourceId: asOptionalText(payload.sourceId),
          counterpartyId,
          contactId,
          ownerId,
          dealId,
          paymentTerms: asOptionalText(payload.paymentTerms),
          deliveryTerms: asOptionalText(payload.deliveryTerms),
          leadTime: asOptionalText(payload.leadTime),
          incoterms: asOptionalText(payload.incoterms),
          notes: resolvedAnnotation,
          internalNotes: asOptionalText(payload.internalNotes),
          billingAddressSnapshot: payload.billingAddressSnapshot || null,
          shippingAddressSnapshot: payload.shippingAddressSnapshot || null,
          meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
          createdBy,
          updatedBy: createdBy,
          lastStatusChangedAt: new Date(),
          totalNet: 0,
          totalTax: 0,
          totalGross: 0,
          discountTotal: 0,
          roundingTotal: 0,
          itemsCount: 0,
          linesCount: 0,
        }, { transaction: tx });
        break;
      } catch (error) {
        if (!manualNumber && isNumberConstraintError(error, 'offers_company_number_uniq')) {
          // eslint-disable-next-line no-await-in-loop
          number = await generateOfferNumber({ companyId, issueDate, transaction: tx });
          continue;
        }
        throw error;
      }
    }

    if (!offer) {
      throw new AppError(409, 'Unable to reserve offer number', { code: 'NUMBERING_FAILURE' });
    }

    if (itemsPayload.length) {
      await saveOfferItems({
        offer,
        itemsPayload,
        userContext,
        transaction: tx,
      });
    }

    createdOfferId = offer.id;
    if (ownTransaction) {
      await tx.commit();
    }
    await logOfferEvent({
      companyId,
      type: 'offer.created',
      offerId: offer.id,
      userId: createdBy,
      payload: { status: offer.status },
    });
    if (!ownTransaction) {
      const createdOffer = await getOfferEntity({
        id: createdOfferId,
        companyId,
        includeItems: true,
        transaction: tx,
      });
      return mapOfferToDetailDto(createdOffer);
    }
    return getOfferById(offer.id, userContext);
  } catch (error) {
    if (ownTransaction) {
      await tx.rollback();
    }
    throw error;
  }
}

async function updateOffer(id, payload = {}, userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const tx = await sequelize.transaction();
  try {
    const offer = await Offer.findOne({
      where: { id, companyId },
      transaction: tx,
    });
    if (!offer) {
      throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
    }

    assertOfferEditable(offer);

    if (payload.status !== undefined) {
      throw new AppError(400, 'Status must be changed via action endpoints', {
        code: 'VALIDATION_ERROR',
      });
    }

    const nextIssueDate = payload.issueDate !== undefined
      ? asDateOnly(payload.issueDate, 'issueDate')
      : offer.issueDate;
    const nextValidUntil = payload.validUntil !== undefined
      ? asDateOnly(payload.validUntil, 'validUntil')
      : offer.validUntil;
    if (nextIssueDate && nextValidUntil && nextValidUntil < nextIssueDate) {
      throw new AppError(400, 'validUntil cannot be earlier than issueDate', {
        code: 'VALIDATION_ERROR',
      });
    }

    const nextCounterpartyId = payload.counterpartyId !== undefined
      ? asOptionalText(payload.counterpartyId)
      : offer.counterpartyId;
    const nextContactId = payload.contactId !== undefined ? asOptionalText(payload.contactId) : offer.contactId;
    const nextOwnerId = payload.ownerId !== undefined ? asOptionalText(payload.ownerId) : offer.ownerId;
    const nextDealId = payload.dealId !== undefined ? asOptionalText(payload.dealId) : offer.dealId;

    await assertCounterpartyInCompany(nextCounterpartyId, companyId, tx);
    await assertContactInCompany(nextContactId, companyId, tx);
    await assertOwnerInCompany(nextOwnerId, companyId, tx);
    await assertDealInCompany(nextDealId, companyId, tx);

    await offer.update({
      title: payload.title !== undefined ? asOptionalText(payload.title) : offer.title,
      subject: payload.subject !== undefined ? asOptionalText(payload.subject) : offer.subject,
      issueDate: nextIssueDate,
      validUntil: nextValidUntil,
      currency: payload.currency !== undefined
        ? asText(payload.currency || 'PLN').toUpperCase().slice(0, 3)
        : offer.currency,
      exchangeRate: payload.exchangeRate !== undefined ? asNumber(payload.exchangeRate, null) : offer.exchangeRate,
      sourceType: payload.sourceType !== undefined ? asOptionalText(payload.sourceType) : offer.sourceType,
      sourceId: payload.sourceId !== undefined ? asOptionalText(payload.sourceId) : offer.sourceId,
      counterpartyId: nextCounterpartyId,
      contactId: nextContactId,
      ownerId: nextOwnerId,
      dealId: nextDealId,
      paymentTerms: payload.paymentTerms !== undefined ? asOptionalText(payload.paymentTerms) : offer.paymentTerms,
      deliveryTerms: payload.deliveryTerms !== undefined ? asOptionalText(payload.deliveryTerms) : offer.deliveryTerms,
      leadTime: payload.leadTime !== undefined ? asOptionalText(payload.leadTime) : offer.leadTime,
      incoterms: payload.incoterms !== undefined ? asOptionalText(payload.incoterms) : offer.incoterms,
      notes: payload.notes !== undefined ? asOptionalText(payload.notes) : offer.notes,
      internalNotes: payload.internalNotes !== undefined
        ? asOptionalText(payload.internalNotes)
        : offer.internalNotes,
      billingAddressSnapshot: payload.billingAddressSnapshot !== undefined
        ? payload.billingAddressSnapshot
        : offer.billingAddressSnapshot,
      shippingAddressSnapshot: payload.shippingAddressSnapshot !== undefined
        ? payload.shippingAddressSnapshot
        : offer.shippingAddressSnapshot,
      meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : offer.meta,
      updatedBy: userContext?.id || null,
    }, { transaction: tx });

    if (Array.isArray(payload.items)) {
      await saveOfferItems({
        offer,
        itemsPayload: payload.items,
        userContext,
        transaction: tx,
      });
      await logOfferEvent({
        companyId,
        type: 'offer.items.updated',
        offerId: offer.id,
        userId: userContext?.id,
        payload: { linesCount: payload.items.length },
      });
    }

    await tx.commit();
    await logOfferEvent({
      companyId,
      type: 'offer.updated',
      offerId: offer.id,
      userId: userContext?.id,
    });
    return getOfferById(offer.id, userContext);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function deleteOffer(id, userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const tx = await sequelize.transaction();
  try {
    const offer = await Offer.findOne({
      where: { id, companyId },
      transaction: tx,
    });
    if (!offer) {
      throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
    }

    if (offer.convertedOrderId) {
      throw new AppError(409, 'Converted offer cannot be deleted', { code: 'OFFER_DELETE_FORBIDDEN' });
    }
    if (String(offer.status || '').toLowerCase() !== 'draft') {
      throw new AppError(409, 'Only draft offer can be deleted', { code: 'OFFER_DELETE_FORBIDDEN' });
    }

    await offer.destroy({ transaction: tx });
    await tx.commit();

    await logOfferEvent({
      companyId,
      type: 'offer.deleted',
      offerId: id,
      userId: userContext?.id,
    });
    return { success: true };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function saveOfferItemsById(id, itemsPayload = [], userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const tx = await sequelize.transaction();
  try {
    const offer = await Offer.findOne({
      where: { id, companyId },
      transaction: tx,
    });
    if (!offer) {
      throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
    }

    await saveOfferItems({
      offer,
      itemsPayload,
      userContext,
      transaction: tx,
    });
    await tx.commit();

    await logOfferEvent({
      companyId,
      type: 'offer.items.updated',
      offerId: id,
      userId: userContext?.id,
      payload: { linesCount: Array.isArray(itemsPayload) ? itemsPayload.length : 0 },
    });
    return getOfferById(id, userContext);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function recalculateOfferTotals(offerId, transaction = null) {
  const ownTransaction = !transaction;
  const tx = transaction || (await sequelize.transaction());
  try {
    const offer = await Offer.findByPk(offerId, { transaction: tx, lock: tx.LOCK.UPDATE });
    if (!offer) {
      throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
    }

    const items = await OfferItem.findAll({
      where: { offerId, companyId: offer.companyId },
      transaction: tx,
    });

    const totals = calculateOfferTotals(
      items.map((item) => ({
        lineSubtotalNet: item.lineSubtotalNet || round(asNumber(item.qty) * asNumber(item.priceNet), 4),
        lineVat: item.lineVat || round((asNumber(item.qty) * asNumber(item.priceNet) * asNumber(item.taxRate)) / 100, 4),
        lineTotalGross: item.lineTotalGross || round(asNumber(item.qty) * asNumber(item.priceGross), 4),
        discountAmount: item.discountAmount || 0,
      }))
    );

    await offer.update({
      totalNet: totals.subtotalNet,
      totalTax: totals.totalVat,
      totalGross: totals.totalGross,
      discountTotal: totals.discountTotal,
      roundingTotal: totals.roundingTotal,
      linesCount: totals.linesCount,
      itemsCount: totals.itemsCount,
    }, { transaction: tx });

    if (ownTransaction) {
      await tx.commit();
    }
    return totals;
  } catch (error) {
    if (ownTransaction) {
      await tx.rollback();
    }
    throw error;
  }
}

async function changeOfferStatus(id, targetStatus, payload = {}, userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const normalizedTarget = assertStatus(targetStatus);
  const tx = await sequelize.transaction();
  try {
    const offer = await Offer.findOne({
      where: { id, companyId },
      transaction: tx,
    });
    if (!offer) {
      throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
    }

    const previous = String(offer.status || '').toLowerCase();
    const next = validateStatusTransition(previous, normalizedTarget);
    if (TERMINAL_STATUSES.has(previous) && previous !== next) {
      throw new AppError(409, `Offer in status "${previous}" cannot be changed`, {
        code: 'INVALID_STATUS_TRANSITION',
      });
    }

    const patch = {
      status: next,
      updatedBy: userContext?.id || null,
      lastStatusChangedAt: new Date(),
    };
    const now = new Date();

    if (next === 'sent') {
      patch.sentAt = now;
      patch.sentBy = userContext?.id || null;
    } else if (next === 'viewed') {
      patch.viewedAt = now;
      patch.viewedBy = userContext?.id || null;
    } else if (next === 'accepted') {
      patch.acceptedAt = now;
      patch.acceptedBy = userContext?.id || null;
    } else if (next === 'rejected') {
      patch.rejectedAt = now;
      patch.rejectedBy = userContext?.id || null;
    } else if (next === 'cancelled') {
      patch.cancelledAt = now;
      patch.cancelledBy = userContext?.id || null;
    }

    if (payload?.internalNotesAppend) {
      const chunk = asText(payload.internalNotesAppend);
      if (chunk) {
        patch.internalNotes = offer.internalNotes
          ? `${offer.internalNotes}\n${chunk}`
          : chunk;
      }
    }

    await offer.update(patch, { transaction: tx });
    await tx.commit();

    await logOfferEvent({
      companyId,
      type: 'offer.status.changed',
      offerId: offer.id,
      userId: userContext?.id,
      payload: { from: previous, to: next },
    });

    return getOfferById(id, userContext);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function duplicateOffer(id, payload = {}, userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const tx = await sequelize.transaction();
  try {
    const source = await getOfferEntity({
      id,
      companyId,
      transaction: tx,
      includeItems: true,
    });
    if (!source) {
      throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
    }

    const issueDate = asDateOnly(payload.issueDate || new Date(), 'issueDate', { required: true });
    const manualNumber = asOptionalText(payload.number);
    let number = manualNumber;
    if (!number) {
      number = await generateOfferNumber({ companyId, issueDate, transaction: tx });
    }

    let duplicate = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        duplicate = await Offer.create({
          companyId,
          number,
          status: 'draft',
          title: asOptionalText(payload.title) || source.title,
          subject: asOptionalText(payload.subject) || source.subject,
          issueDate,
          validUntil: source.validUntil,
          currency: source.currency || 'PLN',
          exchangeRate: source.exchangeRate,
          sourceType: 'copied',
          sourceId: source.id,
          counterpartyId: source.counterpartyId,
          contactId: source.contactId,
          ownerId: source.ownerId,
          dealId: source.dealId,
          paymentTerms: source.paymentTerms,
          deliveryTerms: source.deliveryTerms,
          leadTime: source.leadTime,
          incoterms: source.incoterms,
          notes: source.notes,
          internalNotes: source.internalNotes,
          billingAddressSnapshot: source.billingAddressSnapshot,
          shippingAddressSnapshot: source.shippingAddressSnapshot,
          meta: source.meta || {},
          createdBy: userContext?.id || null,
          updatedBy: userContext?.id || null,
          lastStatusChangedAt: new Date(),
          totalNet: 0,
          totalTax: 0,
          totalGross: 0,
          discountTotal: 0,
          roundingTotal: 0,
          itemsCount: 0,
          linesCount: 0,
        }, { transaction: tx });
        break;
      } catch (error) {
        if (!manualNumber && isNumberConstraintError(error, 'offers_company_number_uniq')) {
          // eslint-disable-next-line no-await-in-loop
          number = await generateOfferNumber({ companyId, issueDate, transaction: tx });
          continue;
        }
        throw error;
      }
    }

    if (!duplicate) {
      throw new AppError(409, 'Unable to reserve offer number', { code: 'NUMBERING_FAILURE' });
    }

    const sourceItems = Array.isArray(source.items) ? source.items : [];
    if (sourceItems.length) {
      await saveOfferItems({
        offer: duplicate,
        itemsPayload: sourceItems.map((item) => ({
          sortOrder: item.sortOrder,
          productId: item.productId,
          variantId: item.variantId,
          unitId: item.uomId,
          nameSnapshot: item.nameSnapshot,
          skuSnapshot: item.skuSnapshot || item.sku,
          descriptionSnapshot: item.descriptionSnapshot,
          unitSnapshot: item.unitSnapshot,
          vatRateSnapshot: item.vatRateSnapshot ?? item.taxRate,
          productTypeSnapshot: item.productTypeSnapshot,
          metadataSnapshot: item.metadataSnapshot,
          quantity: item.qty,
          unitPriceNet: item.priceNet,
          discountType: item.discountType,
          discountValue: item.discountValue,
          isCustomLine: item.isCustomLine,
          lineType: item.lineType,
          affectsInventory: item.affectsInventory,
          isStockTrackedSnapshot: item.isStockTrackedSnapshot,
          taxCategoryId: item.taxCategoryId,
          parentLineItemId: null,
          __preserveLineSemantics: true,
          notes: item.notes,
        })),
        userContext,
        transaction: tx,
      });
    }

    await tx.commit();

    await logOfferEvent({
      companyId,
      type: 'offer.duplicated',
      offerId: duplicate.id,
      userId: userContext?.id,
      payload: { sourceOfferId: source.id },
    });
    return getOfferById(duplicate.id, userContext);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function convertOfferToOrder(id, payload = {}, userContext = {}, options = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const externalTx = options?.transaction || userContext?.transaction || null;
  const tx = externalTx || await sequelize.transaction();
  const ownTransaction = !externalTx;
  try {
    const offer = await Offer.findOne({
      where: { id, companyId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!offer) {
      throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
    }

    assertOfferConvertible(offer);

    const orderIssueDate = asDateOnly(payload.issueDate || new Date(), 'issueDate', { required: true });
    const manualOrderNumber = asOptionalText(payload.number);
    const orderSettings = await getCompanyOrderSettings({
      companyId,
      transaction: tx,
    });
    let orderNumber = manualOrderNumber;
    if (!orderNumber) {
      orderNumber = await generateOrderNumber({
        companyId,
        issueDate: orderIssueDate,
        transaction: tx,
      });
    }

    let order = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        order = await Order.create({
          companyId,
          number: orderNumber,
          offerId: offer.id,
          sourceOfferId: offer.id,
          sourceType: 'offer',
          sourceId: offer.id,
          customerId: offer.counterpartyId,
          contactId: offer.contactId,
          ownerId: offer.ownerId,
          currencyCode: offer.currency || 'PLN',
          status: 'new',
          paymentStatus: 'pending',
          fulfillmentStatus: 'unfulfilled',
          placedAt: new Date(orderIssueDate),
          notes: resolveOrderAnnotation({
            orderSettings,
            incomingAnnotation: payload.notes,
            sourceDocumentAnnotation: offer.notes,
          }),
          paymentTerms: offer.paymentTerms,
          deliveryTerms: offer.deliveryTerms,
          leadTime: offer.leadTime,
          totalNet: offer.totalNet,
          totalTax: offer.totalTax,
          totalGross: offer.totalGross,
          createdBy: userContext?.id || null,
          updatedBy: userContext?.id || null,
        }, { transaction: tx });
        break;
      } catch (error) {
        if (!manualOrderNumber && isNumberConstraintError(error, 'orders_company_number_uniq')) {
          // eslint-disable-next-line no-await-in-loop
          orderNumber = await generateOrderNumber({
            companyId,
            issueDate: orderIssueDate,
            transaction: tx,
          });
          continue;
        }
        throw error;
      }
    }

    if (!order) {
      throw new AppError(409, 'Unable to reserve order number', { code: 'NUMBERING_FAILURE' });
    }

    const sourceItems = await OfferItem.findAll({
      where: { offerId: offer.id, companyId },
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
      transaction: tx,
    });

    const items = Array.isArray(sourceItems) ? sourceItems : [];
    if (items.length) {
      const orderItemIdsByOfferItemId = new Map(items.map((item) => [item.id, crypto.randomUUID()]));
      await OrderItem.bulkCreate(
        items.map((item) => {
          const parentOfferItemId = item.parentLineItemId || null;
          const mappedParentLineItemId = parentOfferItemId
            ? orderItemIdsByOfferItemId.get(parentOfferItemId) || null
            : null;
          return {
            id: orderItemIdsByOfferItemId.get(item.id),
            companyId,
            orderId: order.id,
            productId: item.productId || null,
            variantId: item.variantId || null,
            uomId: item.uomId || null,
            sortOrder: item.sortOrder || 0,
            sku: item.sku || null,
            skuSnapshot: item.skuSnapshot || item.sku || null,
            nameSnapshot: item.nameSnapshot || null,
            descriptionSnapshot: item.descriptionSnapshot || null,
            unitSnapshot: item.unitSnapshot || null,
            vatRateSnapshot: item.vatRateSnapshot ?? item.taxRate ?? 0,
            productTypeSnapshot: item.productTypeSnapshot || null,
            metadataSnapshot: item.metadataSnapshot || null,
            qty: item.qty,
            priceNet: item.priceNet,
            priceGross: item.priceGross,
            taxRate: item.taxRate ?? 0,
            discountType: item.discountType || 'none',
            discountValue: item.discountValue || 0,
            discountAmount: item.discountAmount || 0,
            lineSubtotalNet: item.lineSubtotalNet || 0,
            lineVat: item.lineVat || 0,
            lineTotalGross: item.lineTotalGross || 0,
            isCustomLine: Boolean(item.isCustomLine),
            lineType: item.lineType || 'custom',
            affectsInventory: Boolean(item.affectsInventory),
            isStockTrackedSnapshot: Boolean(item.isStockTrackedSnapshot),
            taxCategoryId: item.taxCategoryId || null,
            parentLineItemId: mappedParentLineItemId,
            notes: item.notes || null,
          };
        }),
        { transaction: tx }
      );
    }

    if (shouldReserveProducts(orderSettings)) {
      // TODO(order-reservation): reserve stock for converted offer lines once reservation orchestration is implemented.
    }

    await offer.update({
      convertedAt: new Date(),
      convertedBy: userContext?.id || null,
      convertedOrderId: order.id,
      updatedBy: userContext?.id || null,
    }, { transaction: tx });

    if (ownTransaction) {
      await tx.commit();
    }

    await logOfferEvent({
      companyId,
      type: 'offer.converted_to_order',
      offerId: offer.id,
      userId: userContext?.id,
      payload: { orderId: order.id },
    });

    if (!ownTransaction) {
      const convertedOffer = await getOfferEntity({
        id: offer.id,
        companyId,
        transaction: tx,
        includeItems: true,
      });
      return {
        order: mapOrderSummary(order),
        offer: mapOfferToDetailDto(convertedOffer),
      };
    }

    return {
      order: mapOrderSummary(order),
      offer: await getOfferById(offer.id, userContext),
    };
  } catch (error) {
    if (ownTransaction) {
      await tx.rollback();
    }
    throw error;
  }
}

async function convertOfferToInvoice(id, payload = {}, userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) throw new AppError(403, 'Company context required');

  const offer = await Offer.findOne({
    where: { id, companyId },
    attributes: ['id', 'companyId', 'status', 'convertedOrderId', 'number', 'counterpartyId', 'contactId', 'currency'],
  });
  if (!offer) {
    throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
  }

  if (asText(offer.status).toLowerCase() !== 'accepted') {
    throw new AppError(409, 'Only accepted offer can be converted to invoice', {
      code: 'OFFER_NOT_CONVERTIBLE',
    });
  }

  let targetOrderId = offer.convertedOrderId;
  if (!targetOrderId) {
    const conversion = await convertOfferToOrder(id, {}, userContext);
    targetOrderId = conversion?.order?.id;
  }

  if (!targetOrderId) {
    throw new AppError(409, 'Unable to resolve order for invoice conversion', {
      code: 'OFFER_INVOICE_CONVERSION_FAILED',
    });
  }

  const targetOrder = await Order.findOne({
    where: { id: targetOrderId, companyId },
    attributes: ['id', 'number', 'companyId', 'status', 'customerId', 'contactId', 'currencyCode', 'paymentTerms', 'notes', 'totalNet', 'totalTax', 'totalGross'],
  });
  if (!targetOrder) {
    throw new AppError(404, 'Order for converted offer not found', { code: 'NOT_FOUND' });
  }

  const existingInvoice = await Invoice.findOne({
    where: { companyId, orderId: targetOrder.id },
    attributes: ['id'],
  });
  if (existingInvoice) {
    throw new AppError(409, 'Offer is already converted to invoice', {
      code: 'OFFER_ALREADY_CONVERTED_TO_INVOICE',
    });
  }

  const invoicePayload = {
    number: asOptionalText(payload.number) || undefined,
    issueDate: payload.issueDate || undefined,
    notes: asOptionalText(payload.notes) || undefined,
    invoiceType: asOptionalText(payload.invoiceType) || undefined,
    sourceType: 'offer',
    sourceId: offer.id,
  };
  const invoice = await invoiceService.issue(targetOrder.id, invoicePayload);

  await logOfferEvent({
    companyId,
    type: 'offer.converted_to_invoice',
    offerId: offer.id,
    userId: userContext?.id,
    payload: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      orderId: targetOrder.id,
      source: {
        counterpartyId: targetOrder.customerId,
        contactId: targetOrder.contactId || null,
        currencyCode: targetOrder.currencyCode || null,
        paymentTerms: targetOrder.paymentTerms || null,
        notes: targetOrder.notes || null,
        totalNet: asNumber(targetOrder.totalNet, 0),
        totalTax: asNumber(targetOrder.totalTax, 0),
        totalGross: asNumber(targetOrder.totalGross, 0),
      },
    },
  });

  return {
    invoice,
    sourceOffer: {
      id: offer.id,
      number: offer.number || null,
      status: offer.status,
      counterpartyId: offer.counterpartyId || null,
      contactId: offer.contactId || null,
      currency: offer.currency || null,
    },
    sourceOrder: {
      id: targetOrder.id,
      number: targetOrder.number || null,
      status: targetOrder.status,
      counterpartyId: targetOrder.customerId || null,
      contactId: targetOrder.contactId || null,
      currencyCode: targetOrder.currencyCode || null,
      paymentTerms: targetOrder.paymentTerms || null,
      notes: targetOrder.notes || null,
      totals: {
        totalNet: asNumber(targetOrder.totalNet, 0),
        totalTax: asNumber(targetOrder.totalTax, 0),
        totalGross: asNumber(targetOrder.totalGross, 0),
      },
    },
  };
}

async function getMeta(_query = {}, _userContext = {}) {
  return {
    statuses: OFFER_STATUSES,
    discountTypes: DISCOUNT_TYPES,
  };
}

module.exports = {
  listOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
  saveOfferItems: saveOfferItemsById,
  recalculateOfferTotals,
  changeOfferStatus,
  duplicateOffer,
  convertOfferToOrder,
  convertOfferToInvoice,
  validateStatusTransition,
  buildOfferItemSnapshots,
  calculateOfferItemTotals,
  calculateOfferTotals,
  assertOfferEditable,
  assertOfferConvertible,
  generateOfferNumber,
  mapOfferToDetailDto,
  mapOfferToListDto,
  getMeta,

  // Backward compatibility with previous controller names
  list: listOffers,
  get: getOfferById,
  create: createOffer,
  update: updateOffer,
  remove: deleteOffer,
  convertToInvoice: convertOfferToInvoice,
};
