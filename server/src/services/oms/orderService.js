'use strict';

const { Op, fn, col, where: sqlWhere } = require('sequelize');
const AppError = require('../../errors/AppError');
const {
  sequelize,
  Order,
  OrderItem,
  Offer,
  OfferItem,
  Counterparty,
  Contact,
  User,
  UserCompany,
  Product,
  Uom,
  TaxCategory,
  ProductType,
  Channel,
  ShippingClass,
  Invoice,
  Payment,
  Shipment,
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

const ORDER_STATUSES = Object.freeze([
  'draft',
  'new',
  'confirmed',
  'paid',
  'shipped',
  'completed',
  'cancelled',
  'returned',
]);
const PAYMENT_STATUSES = Object.freeze(['pending', 'paid', 'refunded', 'partially_refunded']);
const FULFILLMENT_STATUSES = Object.freeze(['unfulfilled', 'partial', 'fulfilled']);
const DISCOUNT_TYPES = Object.freeze(['none', 'fixed', 'percent']);

const EDITABLE_STATUSES = new Set(['draft', 'new', 'confirmed']);
const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(['new', 'cancelled']),
  new: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['paid', 'shipped', 'completed', 'cancelled']),
  paid: new Set(['shipped', 'completed', 'returned']),
  shipped: new Set(['completed', 'returned']),
  completed: new Set(['returned']),
  cancelled: new Set([]),
  returned: new Set([]),
});
const SORTABLE_FIELDS = new Set([
  'number',
  'status',
  'paymentStatus',
  'fulfillmentStatus',
  'totalNet',
  'totalTax',
  'totalGross',
  'placedAt',
  'createdAt',
  'updatedAt',
]);
const ORDER_NUMBER_CONSTRAINT = 'orders_company_number_uniq';
const INVOICE_CONVERTIBLE_ORDER_STATUSES = new Set(['confirmed', 'paid', 'shipped', 'completed']);

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

function round(value, scale = 2) {
  const factor = 10 ** scale;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function asDate(value, fieldName, { required = false } = {}) {
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
  return date;
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
  let sortBy = sortByRaw;
  let sortOrder = asText(query.sortOrder || query.dir || 'DESC').toUpperCase();

  if (sortBy.includes(':')) {
    const [field, direction] = sortBy.split(':');
    sortBy = asText(field);
    sortOrder = asText(direction || sortOrder).toUpperCase();
  }

  const field = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'updatedAt';
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
  const normalized = asText(status).toLowerCase();
  if (!ORDER_STATUSES.includes(normalized)) {
    throw new AppError(400, `Unsupported status "${status}"`, { code: 'VALIDATION_ERROR' });
  }
  return normalized;
}

function assertPaymentStatus(status) {
  if (!status) return null;
  const normalized = asText(status).toLowerCase();
  if (!PAYMENT_STATUSES.includes(normalized)) {
    throw new AppError(400, `Unsupported paymentStatus "${status}"`, { code: 'VALIDATION_ERROR' });
  }
  return normalized;
}

function assertFulfillmentStatus(status) {
  if (!status) return null;
  const normalized = asText(status).toLowerCase();
  if (!FULFILLMENT_STATUSES.includes(normalized)) {
    throw new AppError(400, `Unsupported fulfillmentStatus "${status}"`, { code: 'VALIDATION_ERROR' });
  }
  return normalized;
}

function validateStatusTransition(currentStatus, nextStatus) {
  const current = assertStatus(currentStatus);
  const next = assertStatus(nextStatus);
  if (current === next) return next;

  const allowed = STATUS_TRANSITIONS[current] || new Set();
  if (!allowed.has(next)) {
    throw new AppError(409, `Invalid order status transition: ${current} -> ${next}`, {
      code: 'INVALID_STATUS_TRANSITION',
      details: { currentStatus: current, nextStatus: next },
    });
  }
  return next;
}

function assertOrderEditable(order) {
  const status = asText(order?.status).toLowerCase();
  if (!EDITABLE_STATUSES.has(status)) {
    throw new AppError(409, `Order in status "${status}" is not editable`, {
      code: 'ORDER_NOT_EDITABLE',
    });
  }
}

function assertCompanyContext(userContext = {}) {
  const companyId = userContext?.companyId;
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
  return companyId;
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

function mapSourceOfferSummary(offer) {
  if (!offer) return null;
  return {
    id: offer.id,
    number: offer.number || null,
    status: offer.status || null,
    totalGross: asNumber(offer.totalGross, 0),
    currency: offer.currencyCode || offer.currency || null,
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

function mapOrderItemDto(item) {
  return {
    id: item.id,
    companyId: item.companyId,
    orderId: item.orderId,
    sortOrder: item.sortOrder,
    productId: item.productId || null,
    variantId: item.variantId || null,
    unitId: item.uomId || null,
    uomId: item.uomId || null,
    skuSnapshot: item.skuSnapshot || item.sku || null,
    nameSnapshot: item.nameSnapshot || null,
    descriptionSnapshot: item.descriptionSnapshot || null,
    unitSnapshot: item.unitSnapshot || null,
    vatRateSnapshot: asNumber(item.vatRateSnapshot ?? item.taxRate, 0),
    productTypeSnapshot: item.productTypeSnapshot || null,
    metadataSnapshot: item.metadataSnapshot || null,
    quantity: asNumber(item.qty, 0),
    qty: asNumber(item.qty, 0),
    unitPriceNet: asNumber(item.priceNet, 0),
    priceNet: asNumber(item.priceNet, 0),
    unitPriceGross: asNumber(item.priceGross, 0),
    priceGross: asNumber(item.priceGross, 0),
    discountType: item.discountType || 'none',
    discountValue: asNumber(item.discountValue, 0),
    discountAmount: asNumber(item.discountAmount, 0),
    lineSubtotalNet: asNumber(item.lineSubtotalNet, 0),
    lineVat: asNumber(item.lineVat, 0),
    lineTotalGross: asNumber(item.lineTotalGross, 0),
    isCustomLine: Boolean(item.isCustomLine),
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

function getAvailableActions(order, links = {}) {
  const status = asText(order?.status).toLowerCase();
  const isTerminal = status === 'cancelled' || status === 'returned';
  const hasLinkedEntities = Boolean(links.hasInvoices || links.hasPayments || links.hasShipments);

  return {
    canEdit: EDITABLE_STATUSES.has(status),
    canDelete: status === 'draft' && !hasLinkedEntities,
    canConfirm: status === 'new',
    canShip: status === 'confirmed' || status === 'paid',
    canComplete: status === 'confirmed' || status === 'paid' || status === 'shipped',
    canCancel: status === 'draft' || status === 'new' || status === 'confirmed',
    canReturn: status === 'paid' || status === 'shipped' || status === 'completed',
    canConvertToInvoice: false,
    isTerminal,
  };
}

function mapOrderToListDto(order) {
  const counterparty = mapCounterpartySummary(order.counterparty || order.customer);
  return {
    id: order.id,
    number: order.number || null,
    status: order.status || null,
    paymentStatus: order.paymentStatus || null,
    fulfillmentStatus: order.fulfillmentStatus || null,
    counterparty,
    customer: counterparty,
    contact: mapContactSummary(order.contact),
    owner: mapUserSummary(order.owner),
    currencyCode: order.currencyCode || null,
    totalNet: asNumber(order.totalNet, 0),
    totalTax: asNumber(order.totalTax, 0),
    totalGross: asNumber(order.totalGross, 0),
    placedAt: order.placedAt || null,
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    sourceOfferId: order.sourceOfferId || null,
  };
}

function mapOrderToDetailDto(order, links = {}, related = {}) {
  const listDto = mapOrderToListDto(order);
  const statusMetadata = {
    status: order.status || null,
    placedAt: order.placedAt || null,
    confirmedAt: order.confirmedAt || null,
    shippedAt: order.shippedAt || null,
    completedAt: order.completedAt || null,
    cancelledAt: order.cancelledAt || null,
  };

  return {
    ...listDto,
    companyId: order.companyId,
    customerId: order.customerId || null,
    counterpartyId: order.customerId || null,
    contactId: order.contactId || null,
    ownerId: order.ownerId || null,
    offerId: order.offerId || null,
    salesChannelId: order.salesChannelId || null,
    shippingClassId: order.shippingClassId || null,
    notes: order.notes || null,
    paymentTerms: order.paymentTerms || null,
    deliveryTerms: order.deliveryTerms || null,
    leadTime: order.leadTime || null,
    sourceType: order.sourceType || null,
    sourceId: order.sourceId || null,
    sourceOffer: mapSourceOfferSummary(order.sourceOffer),
    invoices: Array.isArray(related.invoices) ? related.invoices : [],
    items: Array.isArray(order.items) ? order.items.map(mapOrderItemDto) : [],
    availableActions: getAvailableActions(order, links),
    statusMetadata,
    createdBy: order.createdBy || null,
    updatedBy: order.updatedBy || null,
    createdByUser: mapUserSummary(order.createdByUser),
    updatedByUser: mapUserSummary(order.updatedByUser),
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
  };
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

async function assertOfferInCompany(offerId, companyId, transaction) {
  if (!offerId) return null;
  const row = await Offer.findOne({
    where: { id: offerId, companyId },
    attributes: ['id', 'status', 'counterpartyId', 'contactId', 'ownerId', 'currency', 'currencyCode', 'notes'],
    transaction,
  });
  if (!row) {
    throw new AppError(400, 'sourceOfferId is invalid', { code: 'VALIDATION_ERROR' });
  }
  return row;
}

async function assertSalesChannelInCompany(salesChannelId, companyId, transaction) {
  if (!salesChannelId) return;
  const row = await Channel.findOne({
    where: { id: salesChannelId, companyId },
    attributes: ['id'],
    transaction,
  });
  if (!row) {
    throw new AppError(400, 'salesChannelId is invalid', { code: 'VALIDATION_ERROR' });
  }
}

async function assertShippingClassInCompany(shippingClassId, companyId, transaction) {
  if (!shippingClassId) return;
  const row = await ShippingClass.findOne({
    where: { id: shippingClassId, companyId },
    attributes: ['id'],
    transaction,
  });
  if (!row) {
    throw new AppError(400, 'shippingClassId is invalid', { code: 'VALIDATION_ERROR' });
  }
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

async function ensureManualNumberUnique({ companyId, number, transaction, excludeOrderId = null }) {
  const normalized = asOptionalText(number);
  if (!normalized) return;

  const whereClause = { companyId, number: normalized };
  if (excludeOrderId) {
    whereClause.id = { [Op.ne]: excludeOrderId };
  }
  const existing = await Order.findOne({
    where: whereClause,
    attributes: ['id'],
    transaction,
  });
  if (existing) {
    throw new AppError(409, 'Order number already exists', {
      code: 'NUMBERING_FAILURE',
    });
  }
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

function buildOrderItemSnapshots({ input, sourceProduct }) {
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

function calculateOrderItemTotals(item) {
  const quantity = asPositiveNumber(item.quantity ?? item.qty, 'quantity');
  const unitPriceNet = asNonNegativeNumber(item.unitPriceNet ?? item.priceNet, 'unitPriceNet');
  const discountTypeRaw = asText(item.discountType || 'none').toLowerCase() || 'none';
  const discountType = DISCOUNT_TYPES.includes(discountTypeRaw) ? discountTypeRaw : 'none';
  const discountValue = asNonNegativeNumber(item.discountValue ?? 0, 'discountValue');
  const taxRate = asNonNegativeNumber(item.taxRate ?? item.vatRateSnapshot ?? 0, 'taxRate');

  const baseNet = round(quantity * unitPriceNet, 2);
  let discountAmount = 0;

  if (discountType === 'fixed') {
    discountAmount = round(Math.min(discountValue, baseNet), 2);
  } else if (discountType === 'percent') {
    if (discountValue > 100) {
      throw new AppError(400, 'Percent discount must be between 0 and 100', {
        code: 'VALIDATION_ERROR',
      });
    }
    discountAmount = round((baseNet * discountValue) / 100, 2);
  }

  const lineSubtotalNet = round(baseNet - discountAmount, 2);
  const lineVat = round((lineSubtotalNet * taxRate) / 100, 2);
  const lineTotalGross = round(lineSubtotalNet + lineVat, 2);
  const unitPriceGross = quantity > 0 ? round(lineTotalGross / quantity, 2) : 0;

  return {
    quantity,
    unitPriceNet,
    unitPriceGross,
    discountType,
    discountValue: round(discountValue, 2),
    discountAmount,
    lineSubtotalNet,
    lineVat,
    lineTotalGross,
    taxRate: round(taxRate, 4),
  };
}

function calculateOrderTotals(items = []) {
  return {
    totalNet: round(items.reduce((acc, item) => acc + asNumber(item.lineSubtotalNet, 0), 0), 2),
    totalTax: round(items.reduce((acc, item) => acc + asNumber(item.lineVat, 0), 0), 2),
    totalGross: round(items.reduce((acc, item) => acc + asNumber(item.lineTotalGross, 0), 0), 2),
  };
}

function normalizeOrderItemInput({ input, index, sourceProduct }) {
  const snapshots = buildOrderItemSnapshots({ input, sourceProduct });
  const productId = asOptionalText(input.productId);
  const isCustomLine = input.isCustomLine !== undefined
    ? Boolean(input.isCustomLine)
    : !productId;

  if (!productId && !snapshots.nameSnapshot) {
    throw new AppError(400, `items[${index}].nameSnapshot is required for custom line`, {
      code: 'VALIDATION_ERROR',
    });
  }

  const quantity = input.quantity ?? input.qty;
  const unitPriceNet = input.unitPriceNet ?? input.priceNet;
  const discountType = asText(input.discountType || 'none').toLowerCase() || 'none';
  const discountValue = input.discountValue ?? 0;
  const calculated = calculateOrderItemTotals({
    quantity,
    unitPriceNet,
    taxRate: snapshots.vatRateSnapshot,
    discountType,
    discountValue,
  });

  const sortOrderRaw = input.sortOrder ?? index;
  const sortOrder = Number.isInteger(Number(sortOrderRaw)) ? Number(sortOrderRaw) : index;

  return {
    sortOrder: sortOrder < 0 ? index : sortOrder,
    productId: productId || null,
    variantId: asOptionalText(input.variantId) || null,
    unitId: asOptionalText(input.unitId || input.uomId) || sourceProduct?.uom?.id || null,
    ...snapshots,
    ...calculated,
    isCustomLine,
    notes: asOptionalText(input.notes),
  };
}

async function buildNormalizedItems({ itemsPayload, companyId, transaction }) {
  if (!Array.isArray(itemsPayload)) {
    throw new AppError(400, 'items must be an array', { code: 'VALIDATION_ERROR' });
  }

  const productIds = [...new Set(itemsPayload.map((item) => asOptionalText(item?.productId)).filter(Boolean))];
  const productsMap = await loadProductsMap({
    companyId,
    productIds,
    transaction,
  });

  const items = itemsPayload.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppError(400, `items[${index}] must be an object`, { code: 'VALIDATION_ERROR' });
    }
    const productId = asOptionalText(item.productId);
    const sourceProduct = productId ? productsMap.get(productId) : null;
    return normalizeOrderItemInput({
      input: item,
      index,
      sourceProduct,
    });
  });

  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

async function saveOrderItemsInternal({
  order,
  itemsPayload,
  userContext,
  transaction,
}) {
  assertOrderEditable(order);

  const normalizedItems = await buildNormalizedItems({
    itemsPayload,
    companyId: order.companyId,
    transaction,
  });
  const totals = calculateOrderTotals(normalizedItems);

  await OrderItem.destroy({
    where: { orderId: order.id, companyId: order.companyId },
    transaction,
  });

  if (normalizedItems.length) {
    await OrderItem.bulkCreate(
      normalizedItems.map((item) => ({
        companyId: order.companyId,
        orderId: order.id,
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
        taxRate: item.taxRate,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount,
        lineSubtotalNet: item.lineSubtotalNet,
        lineVat: item.lineVat,
        lineTotalGross: item.lineTotalGross,
        isCustomLine: item.isCustomLine,
        notes: item.notes,
      })),
      { transaction }
    );
  }

  await order.update({
    totalNet: totals.totalNet,
    totalTax: totals.totalTax,
    totalGross: totals.totalGross,
    updatedBy: userContext?.id || userContext?.userId || null,
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

  const paymentStatuses = normalizeStatusList(query.paymentStatus);
  if (paymentStatuses.length) {
    paymentStatuses.forEach(assertPaymentStatus);
    whereClause.paymentStatus = paymentStatuses.length === 1
      ? paymentStatuses[0]
      : { [Op.in]: paymentStatuses };
  }

  const fulfillmentStatuses = normalizeStatusList(query.fulfillmentStatus);
  if (fulfillmentStatuses.length) {
    fulfillmentStatuses.forEach(assertFulfillmentStatus);
    whereClause.fulfillmentStatus = fulfillmentStatuses.length === 1
      ? fulfillmentStatuses[0]
      : { [Op.in]: fulfillmentStatuses };
  }

  const customerId = asOptionalText(query.customerId || query.counterpartyId);
  if (customerId) whereClause.customerId = customerId;
  if (query.contactId) whereClause.contactId = query.contactId;
  if (query.ownerId) whereClause.ownerId = query.ownerId;
  if (query.salesChannelId) whereClause.salesChannelId = query.salesChannelId;
  if (query.sourceOfferId) whereClause.sourceOfferId = query.sourceOfferId;

  if (query.placedAtFrom || query.placedAtTo) {
    whereClause.placedAt = {};
    if (query.placedAtFrom) whereClause.placedAt[Op.gte] = asDate(query.placedAtFrom, 'placedAtFrom');
    if (query.placedAtTo) whereClause.placedAt[Op.lte] = asDate(query.placedAtTo, 'placedAtTo');
  }

  if (query.amountFrom !== undefined || query.amountTo !== undefined) {
    whereClause.totalGross = {};
    if (query.amountFrom !== undefined) {
      whereClause.totalGross[Op.gte] = asNonNegativeNumber(query.amountFrom, 'amountFrom');
    }
    if (query.amountTo !== undefined) {
      whereClause.totalGross[Op.lte] = asNonNegativeNumber(query.amountTo, 'amountTo');
    }
  }

  const search = asText(query.search || query.q);
  if (search) {
    const like = `%${search}%`;
    whereClause[Op.or] = [
      { number: { [Op.iLike]: like } },
      { notes: { [Op.iLike]: like } },
      { '$counterparty.short_name$': { [Op.iLike]: like } },
      { '$counterparty.full_name$': { [Op.iLike]: like } },
      { '$contact.first_name$': { [Op.iLike]: like } },
      { '$contact.last_name$': { [Op.iLike]: like } },
      sqlWhere(fn('concat', col('contact.first_name'), ' ', col('contact.last_name')), {
        [Op.iLike]: like,
      }),
    ];
  }

  const hasInvoice = parseBoolean(query.hasInvoice);
  if (hasInvoice !== null) {
    const existsSql = hasInvoice
      ? 'EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = "Order"."id" AND i.deleted_at IS NULL)'
      : 'NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = "Order"."id" AND i.deleted_at IS NULL)';
    whereClause[Op.and] = [...(whereClause[Op.and] || []), sequelize.literal(existsSql)];
  }

  return whereClause;
}

async function getOrderEntity({
  id,
  companyId,
  transaction,
  includeItems = true,
}) {
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
      model: Offer,
      as: 'sourceOffer',
      attributes: ['id', 'number', 'status', 'currency', 'currencyCode', 'totalGross'],
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
      model: OrderItem,
      as: 'items',
      required: false,
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku'], required: false },
        { model: Uom, as: 'unit', attributes: ['id', 'code', 'name', 'symbol'], required: false },
      ],
    });
  }

  return Order.findOne({
    where: { id, companyId },
    include,
    order: includeItems ? [[{ model: OrderItem, as: 'items' }, 'sortOrder', 'ASC']] : undefined,
    transaction,
  });
}

async function logOrderEvent({ companyId, type, orderId, userId, payload = {} }) {
  try {
    await eventService.create(
      companyId,
      type,
      { orderId, userId: userId || null, ...payload },
      { type: 'order', id: orderId }
    );
  } catch (_error) {
    // best-effort audit; should never break order flow
  }
}

async function listOrders(query = {}, userContext = {}) {
  const companyId = assertCompanyContext(userContext);
  const { page, limit, offset } = parsePagination(query);
  const whereClause = buildListWhere({ query, companyId });
  const order = parseSort(query);

  const { rows, count } = await Order.findAndCountAll({
    where: whereClause,
    include: [
      { model: Counterparty, as: 'counterparty', attributes: ['id', 'shortName', 'fullName'], required: false },
      { model: Contact, as: 'contact', attributes: ['id', 'firstName', 'lastName', 'displayName', 'email'], required: false },
      { model: User, as: 'owner', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
    ],
    order,
    limit,
    offset,
    subQuery: false,
    distinct: true,
  });

  return {
    items: rows.map(mapOrderToListDto),
    total: count,
    page,
    limit,
  };
}

async function getOrderById(id, userContext = {}) {
  const companyId = assertCompanyContext(userContext);
  const [order, invoiceRows, paymentCount, shipmentCount] = await Promise.all([
    getOrderEntity({
      id,
      companyId,
      includeItems: true,
    }),
    Invoice.findAll({
      where: { companyId, orderId: id },
      order: [['createdAt', 'ASC']],
    }),
    Payment.count({ where: { companyId, orderId: id } }),
    Shipment.count({ where: { companyId, orderId: id } }),
  ]);
  if (!order) {
    throw new AppError(404, 'Order not found', { code: 'NOT_FOUND' });
  }

  const links = {
    hasInvoices: invoiceRows.length > 0,
    hasPayments: paymentCount > 0,
    hasShipments: shipmentCount > 0,
  };
  const invoices = invoiceRows.map((invoice) => mapInvoiceSummary(invoice, order.currencyCode || null));
  return mapOrderToDetailDto(order, links, { invoices });
}

async function createOrder(payload = {}, userContext = {}) {
  const companyId = assertCompanyContext(userContext);
  const sourceDocumentAnnotation = asOptionalText(payload.__sourceDocumentAnnotation) || null;
  let createdOrderId = null;

  const customerId = asOptionalText(payload.customerId || payload.counterpartyId);
  const contactId = asOptionalText(payload.contactId);
  const ownerId = asOptionalText(payload.ownerId);
  const sourceOfferId = asOptionalText(payload.sourceOfferId || payload.offerId);
  const offerId = asOptionalText(payload.offerId);
  const salesChannelId = asOptionalText(payload.salesChannelId);
  const shippingClassId = asOptionalText(payload.shippingClassId);
  const sourceType = asOptionalText(payload.sourceType);
  const sourceId = asOptionalText(payload.sourceId);
  const leadTime = asOptionalText(payload.leadTime);
  const paymentTerms = asOptionalText(payload.paymentTerms);
  const deliveryTerms = asOptionalText(payload.deliveryTerms);
  const manualNumber = asOptionalText(payload.number);
  const placedAt = payload.placedAt ? asDate(payload.placedAt, 'placedAt') : null;
  const currencyCode = asText(payload.currencyCode || payload.currency || 'PLN').toUpperCase();
  if (!currencyCode || currencyCode.length !== 3) {
    throw new AppError(400, 'currencyCode must be a 3-letter code', { code: 'VALIDATION_ERROR' });
  }

  const status = payload.status ? assertStatus(payload.status) : 'draft';
  if (status !== 'draft' && status !== 'new') {
    throw new AppError(400, 'status can be only draft or new during creation', {
      code: 'VALIDATION_ERROR',
    });
  }

  const tx = await sequelize.transaction();
  try {
    await assertCounterpartyInCompany(customerId, companyId, tx);
    await assertContactInCompany(contactId, companyId, tx);
    await assertOwnerInCompany(ownerId, companyId, tx);
    await assertOfferInCompany(sourceOfferId, companyId, tx);
    await assertOfferInCompany(offerId, companyId, tx);
    await assertSalesChannelInCompany(salesChannelId, companyId, tx);
    await assertShippingClassInCompany(shippingClassId, companyId, tx);

    if (manualNumber) {
      await ensureManualNumberUnique({
        companyId,
        number: manualNumber,
        transaction: tx,
      });
    }

    const orderSettings = await getCompanyOrderSettings({
      companyId,
      transaction: tx,
    });
    const notes = resolveOrderAnnotation({
      orderSettings,
      incomingAnnotation: payload.notes,
      sourceDocumentAnnotation,
    });

    const createdBy = userContext?.id || userContext?.userId || null;
    const issueDateForNumber = asDate(payload.issueDate || placedAt || new Date(), 'issueDate');

    let order = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      let number = manualNumber;
      if (!number) {
        // eslint-disable-next-line no-await-in-loop
        number = await generateOrderNumber({
          companyId,
          issueDate: issueDateForNumber,
          transaction: tx,
        });
      }

      const orderPayload = {
        companyId,
        number,
        offerId: offerId || null,
        customerId,
        contactId,
        ownerId,
        salesChannelId,
        shippingClassId,
        currencyCode,
        status,
        paymentStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        placedAt: placedAt || (status === 'new' ? new Date() : null),
        notes,
        paymentTerms,
        deliveryTerms,
        leadTime,
        sourceType,
        sourceId,
        sourceOfferId,
        createdBy,
        updatedBy: createdBy,
      };

      try {
        // eslint-disable-next-line no-await-in-loop
        order = await Order.create(orderPayload, { transaction: tx });
        break;
      } catch (error) {
        if (
          !manualNumber
          && attempt < 5
          && isNumberConstraintError(error, ORDER_NUMBER_CONSTRAINT)
        ) {
          // retry with a newly generated number
          // eslint-disable-next-line no-continue
          continue;
        }
        throw error;
      }
    }

    if (!order) {
      throw new AppError(409, 'Unable to create order number', { code: 'NUMBERING_FAILURE' });
    }

    const itemsPayload = Array.isArray(payload.items) ? payload.items : [];
    await saveOrderItemsInternal({
      order,
      itemsPayload,
      userContext,
      transaction: tx,
    });

    if (shouldReserveProducts(orderSettings)) {
      // TODO(order-reservation): reserve stock for order items when reservation flow is implemented.
    }

    await logOrderEvent({
      companyId,
      type: 'order.created',
      orderId: order.id,
      userId: createdBy,
      payload: {
        status: order.status,
        number: order.number,
      },
    });

    createdOrderId = order.id;
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  return getOrderById(createdOrderId, userContext);
}

async function updateOrder(id, payload = {}, userContext = {}) {
  const companyId = assertCompanyContext(userContext);

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    throw new AppError(400, 'status cannot be changed via update endpoint', {
      code: 'VALIDATION_ERROR',
    });
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'number')) {
    throw new AppError(400, 'number cannot be changed via update endpoint', {
      code: 'VALIDATION_ERROR',
    });
  }

  const tx = await sequelize.transaction();
  let order = null;
  try {
    order = await Order.findOne({
      where: { id, companyId },
      transaction: tx,
    });
    if (!order) {
      throw new AppError(404, 'Order not found', { code: 'NOT_FOUND' });
    }

    assertOrderEditable(order);

    const nextCustomerId = payload.customerId !== undefined || payload.counterpartyId !== undefined
      ? asOptionalText(payload.customerId || payload.counterpartyId)
      : order.customerId;
    const nextContactId = payload.contactId !== undefined ? asOptionalText(payload.contactId) : order.contactId;
    const nextOwnerId = payload.ownerId !== undefined ? asOptionalText(payload.ownerId) : order.ownerId;
    const nextSourceOfferId = payload.sourceOfferId !== undefined
      ? asOptionalText(payload.sourceOfferId)
      : order.sourceOfferId;
    const nextOfferId = payload.offerId !== undefined
      ? asOptionalText(payload.offerId)
      : order.offerId;
    const nextSalesChannelId = payload.salesChannelId !== undefined
      ? asOptionalText(payload.salesChannelId)
      : order.salesChannelId;
    const nextShippingClassId = payload.shippingClassId !== undefined
      ? asOptionalText(payload.shippingClassId)
      : order.shippingClassId;

    await assertCounterpartyInCompany(nextCustomerId, companyId, tx);
    await assertContactInCompany(nextContactId, companyId, tx);
    await assertOwnerInCompany(nextOwnerId, companyId, tx);
    await assertOfferInCompany(nextSourceOfferId, companyId, tx);
    await assertOfferInCompany(nextOfferId, companyId, tx);
    await assertSalesChannelInCompany(nextSalesChannelId, companyId, tx);
    await assertShippingClassInCompany(nextShippingClassId, companyId, tx);

    const nextPaymentStatus = payload.paymentStatus !== undefined
      ? assertPaymentStatus(payload.paymentStatus)
      : undefined;
    const nextFulfillmentStatus = payload.fulfillmentStatus !== undefined
      ? assertFulfillmentStatus(payload.fulfillmentStatus)
      : undefined;

    const updates = {
      customerId: nextCustomerId,
      contactId: nextContactId,
      ownerId: nextOwnerId,
      sourceOfferId: nextSourceOfferId,
      offerId: nextOfferId,
      salesChannelId: nextSalesChannelId,
      shippingClassId: nextShippingClassId,
      sourceType: payload.sourceType !== undefined ? asOptionalText(payload.sourceType) : order.sourceType,
      sourceId: payload.sourceId !== undefined ? asOptionalText(payload.sourceId) : order.sourceId,
      paymentTerms: payload.paymentTerms !== undefined ? asOptionalText(payload.paymentTerms) : order.paymentTerms,
      deliveryTerms: payload.deliveryTerms !== undefined ? asOptionalText(payload.deliveryTerms) : order.deliveryTerms,
      leadTime: payload.leadTime !== undefined ? asOptionalText(payload.leadTime) : order.leadTime,
      notes: payload.notes !== undefined ? asOptionalText(payload.notes) : order.notes,
      currencyCode: payload.currencyCode !== undefined || payload.currency !== undefined
        ? asText(payload.currencyCode || payload.currency).toUpperCase()
        : order.currencyCode,
      placedAt: payload.placedAt !== undefined ? asDate(payload.placedAt, 'placedAt') : order.placedAt,
      updatedBy: userContext?.id || userContext?.userId || null,
    };

    if (!updates.currencyCode || updates.currencyCode.length !== 3) {
      throw new AppError(400, 'currencyCode must be a 3-letter code', { code: 'VALIDATION_ERROR' });
    }
    if (nextPaymentStatus !== undefined) updates.paymentStatus = nextPaymentStatus;
    if (nextFulfillmentStatus !== undefined) updates.fulfillmentStatus = nextFulfillmentStatus;

    await order.update(updates, { transaction: tx });

    if (Array.isArray(payload.items)) {
      await saveOrderItemsInternal({
        order,
        itemsPayload: payload.items,
        userContext,
        transaction: tx,
      });
    }

    await logOrderEvent({
      companyId,
      type: 'order.updated',
      orderId: order.id,
      userId: userContext?.id || userContext?.userId || null,
    });

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  return getOrderById(order.id, userContext);
}

async function deleteOrder(id, userContext = {}) {
  const companyId = assertCompanyContext(userContext);
  const tx = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id, companyId },
      transaction: tx,
    });
    if (!order) {
      throw new AppError(404, 'Order not found', { code: 'NOT_FOUND' });
    }
    if (asText(order.status).toLowerCase() !== 'draft') {
      throw new AppError(409, 'Only draft order can be deleted', {
        code: 'ORDER_DELETE_FORBIDDEN',
      });
    }

    const [invoiceCount, paymentCount, shipmentCount] = await Promise.all([
      Invoice.count({ where: { companyId, orderId: order.id }, transaction: tx }),
      Payment.count({ where: { companyId, orderId: order.id }, transaction: tx }),
      Shipment.count({ where: { companyId, orderId: order.id }, transaction: tx }),
    ]);
    if (invoiceCount > 0 || paymentCount > 0 || shipmentCount > 0) {
      throw new AppError(409, 'Order with related invoices/payments/shipments cannot be deleted', {
        code: 'ORDER_DELETE_FORBIDDEN',
      });
    }

    await order.destroy({ transaction: tx });
    await logOrderEvent({
      companyId,
      type: 'order.deleted',
      orderId: order.id,
      userId: userContext?.id || userContext?.userId || null,
    });
    await tx.commit();
    return { success: true, id: order.id };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function saveOrderItems(id, items = [], userContext = {}) {
  const companyId = assertCompanyContext(userContext);
  const tx = await sequelize.transaction();
  let order = null;
  try {
    order = await Order.findOne({
      where: { id, companyId },
      transaction: tx,
    });
    if (!order) {
      throw new AppError(404, 'Order not found', { code: 'NOT_FOUND' });
    }

    await saveOrderItemsInternal({
      order,
      itemsPayload: items,
      userContext,
      transaction: tx,
    });

    await logOrderEvent({
      companyId,
      type: 'order.items.updated',
      orderId: order.id,
      userId: userContext?.id || userContext?.userId || null,
      payload: { itemsCount: Array.isArray(items) ? items.length : 0 },
    });

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  return getOrderById(order.id, userContext);
}

async function changeOrderStatus(id, targetStatus, payload = {}, userContext = {}) {
  const companyId = assertCompanyContext(userContext);
  const nextStatus = assertStatus(targetStatus);
  const tx = await sequelize.transaction();
  let order = null;
  try {
    order = await Order.findOne({
      where: { id, companyId },
      transaction: tx,
    });
    if (!order) {
      throw new AppError(404, 'Order not found', { code: 'NOT_FOUND' });
    }

    const currentStatus = assertStatus(order.status);
    validateStatusTransition(currentStatus, nextStatus);

    const updates = {
      status: nextStatus,
      updatedBy: userContext?.id || userContext?.userId || null,
    };
    const now = new Date();

    if (nextStatus === 'new' && !order.placedAt) {
      updates.placedAt = now;
    }
    if (nextStatus === 'confirmed') {
      updates.confirmedAt = now;
    }
    if (nextStatus === 'paid') {
      updates.paymentStatus = 'paid';
    }
    if (nextStatus === 'shipped') {
      updates.shippedAt = now;
      updates.fulfillmentStatus = 'fulfilled';
    }
    if (nextStatus === 'completed') {
      updates.completedAt = now;
      updates.fulfillmentStatus = 'fulfilled';
    }
    if (nextStatus === 'cancelled') {
      updates.cancelledAt = now;
    }

    const appendText = asOptionalText(payload.internalNotesAppend);
    if (appendText) {
      const currentNotes = asOptionalText(order.notes);
      updates.notes = currentNotes ? `${currentNotes}\n${appendText}` : appendText;
    }

    await order.update(updates, { transaction: tx });
    await logOrderEvent({
      companyId,
      type: 'order.status.changed',
      orderId: order.id,
      userId: userContext?.id || userContext?.userId || null,
      payload: {
        fromStatus: currentStatus,
        toStatus: nextStatus,
      },
    });

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  return getOrderById(order.id, userContext);
}

async function convertOrderToInvoice(id, payload = {}, userContext = {}) {
  const companyId = assertCompanyContext(userContext);
  const order = await Order.findOne({
    where: { id, companyId },
    include: [
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
        model: OrderItem,
        as: 'items',
        required: false,
      },
    ],
    order: [[{ model: OrderItem, as: 'items' }, 'sortOrder', 'ASC']],
  });

  if (!order) {
    throw new AppError(404, 'Order not found', { code: 'NOT_FOUND' });
  }

  const orderStatus = asText(order.status).toLowerCase();
  if (!INVOICE_CONVERTIBLE_ORDER_STATUSES.has(orderStatus)) {
    throw new AppError(409, `Order in status "${orderStatus}" cannot be converted to invoice`, {
      code: 'ORDER_NOT_CONVERTIBLE',
    });
  }

  const existingInvoice = await Invoice.findOne({
    where: { companyId, orderId: order.id },
    attributes: ['id'],
  });
  if (existingInvoice) {
    throw new AppError(409, 'Order is already converted to invoice', {
      code: 'ORDER_ALREADY_CONVERTED_TO_INVOICE',
    });
  }

  const invoicePayload = {
    number: asOptionalText(payload.number) || undefined,
    issueDate: payload.issueDate || undefined,
    notes: asOptionalText(payload.notes) || undefined,
    invoiceType: asOptionalText(payload.invoiceType) || undefined,
  };

  const invoice = await invoiceService.issue(order.id, invoicePayload);

  await logOrderEvent({
    companyId,
    type: 'order.converted_to_invoice',
    orderId: order.id,
    userId: userContext?.id || userContext?.userId || null,
    payload: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      source: {
        counterpartyId: order.customerId,
        contactId: order.contactId || null,
        currencyCode: order.currencyCode || null,
        paymentTerms: order.paymentTerms || null,
        notes: order.notes || null,
        itemsCount: Array.isArray(order.items) ? order.items.length : 0,
        totalNet: asNumber(order.totalNet, 0),
        totalTax: asNumber(order.totalTax, 0),
        totalGross: asNumber(order.totalGross, 0),
      },
    },
  });

  return {
    invoice,
    sourceOrder: {
      id: order.id,
      number: order.number || null,
      status: order.status,
      counterparty: mapCounterpartySummary(order.counterparty || order.customer),
      contact: mapContactSummary(order.contact),
      currencyCode: order.currencyCode || null,
      paymentTerms: order.paymentTerms || null,
      notes: order.notes || null,
      totals: {
        totalNet: asNumber(order.totalNet, 0),
        totalTax: asNumber(order.totalTax, 0),
        totalGross: asNumber(order.totalGross, 0),
      },
      items: Array.isArray(order.items) ? order.items.map(mapOrderItemDto) : [],
    },
  };
}

async function createOrderFromOffer(offerId, payload = {}, userContext = {}) {
  const companyId = assertCompanyContext(userContext);
  const tx = await sequelize.transaction();
  try {
    const offer = await Offer.findOne({
      where: { id: offerId, companyId },
      include: [
        {
          model: OfferItem,
          as: 'items',
          required: false,
        },
      ],
      transaction: tx,
    });
    if (!offer) {
      throw new AppError(404, 'Offer not found', { code: 'NOT_FOUND' });
    }
    if (asText(offer.status).toLowerCase() !== 'accepted') {
      throw new AppError(409, 'Only accepted offer can be converted to order', {
        code: 'OFFER_NOT_CONVERTIBLE',
      });
    }

    const mappedItems = (offer.items || []).map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      productId: item.productId || null,
      variantId: item.variantId || null,
      uomId: item.uomId || null,
      nameSnapshot: item.nameSnapshot || null,
      skuSnapshot: item.skuSnapshot || item.sku || null,
      descriptionSnapshot: item.descriptionSnapshot || null,
      unitSnapshot: item.unitSnapshot || null,
      vatRateSnapshot: item.vatRateSnapshot ?? item.taxRate ?? 0,
      productTypeSnapshot: item.productTypeSnapshot || null,
      metadataSnapshot: item.metadataSnapshot || null,
      quantity: asNumber(item.qty, 0),
      unitPriceNet: asNumber(item.priceNet, 0),
      discountType: item.discountType || 'none',
      discountValue: asNumber(item.discountValue, 0),
      isCustomLine: Boolean(item.isCustomLine),
      notes: item.notes || null,
    }));

    await tx.rollback();

    const createPayload = {
      ...payload,
      customerId: payload.customerId || payload.counterpartyId || offer.counterpartyId || offer.customerId,
      contactId: payload.contactId !== undefined ? payload.contactId : offer.contactId,
      ownerId: payload.ownerId !== undefined ? payload.ownerId : offer.ownerId,
      currencyCode: payload.currencyCode || payload.currency || offer.currencyCode || offer.currency || 'PLN',
      status: payload.status || 'new',
      offerId: offer.id,
      sourceOfferId: payload.sourceOfferId || offer.id,
      sourceType: payload.sourceType || 'offer',
      sourceId: payload.sourceId || offer.id,
      items: Array.isArray(payload.items) ? payload.items : mappedItems,
      __sourceDocumentAnnotation: offer.notes || null,
    };

    const created = await createOrder(createPayload, userContext);
    await logOrderEvent({
      companyId,
      type: 'order.created.from_offer',
      orderId: created.id,
      userId: userContext?.id || userContext?.userId || null,
      payload: { offerId: offer.id },
    });
    return created;
  } catch (error) {
    if (!tx.finished) {
      await tx.rollback();
    }
    throw error;
  }
}

async function getMeta(_query = {}, _userContext = {}) {
  return {
    statuses: [...ORDER_STATUSES],
    paymentStatuses: [...PAYMENT_STATUSES],
    fulfillmentStatuses: [...FULFILLMENT_STATUSES],
    discountTypes: [...DISCOUNT_TYPES],
    editableStatuses: [...EDITABLE_STATUSES],
    transitions: Object.fromEntries(
      Object.entries(STATUS_TRANSITIONS).map(([from, set]) => [from, [...set]])
    ),
  };
}

module.exports = {
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  saveOrderItems,
  changeOrderStatus,
  convertOrderToInvoice,
  createOrderFromOffer,
  getMeta,

  // Backward compatibility with current controller names
  list: listOrders,
  get: getOrderById,
  create: createOrder,
  update: updateOrder,
  remove: deleteOrder,
  fromOffer: createOrderFromOffer,
  convertToInvoice: convertOrderToInvoice,

  // Export utility for future reuse/tests
  calculateOrderItemTotals,
  calculateOrderTotals,
};
