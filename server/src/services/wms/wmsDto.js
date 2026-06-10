'use strict';

const {
  Location,
  Order,
  Product,
  ProductVariant,
  StockMove,
  Warehouse,
} = require('../../models');

const WAREHOUSE_SUMMARY_ATTRIBUTES = ['id', 'code', 'name'];
const LOCATION_SUMMARY_ATTRIBUTES = ['id', 'code', 'type'];
const PRODUCT_SUMMARY_ATTRIBUTES = ['id', 'sku', 'name'];
const VARIANT_SUMMARY_ATTRIBUTES = ['id', 'sku'];
const ORDER_SUMMARY_ATTRIBUTES = ['id', 'number', 'status'];

const warehouseInclude = { model: Warehouse, as: 'warehouse', attributes: WAREHOUSE_SUMMARY_ATTRIBUTES, required: false };
const inboundLocationInclude = { model: Location, as: 'inboundLocation', attributes: LOCATION_SUMMARY_ATTRIBUTES, required: false };
const productInclude = { model: Product, as: 'product', attributes: PRODUCT_SUMMARY_ATTRIBUTES, required: false };
const variantInclude = { model: ProductVariant, as: 'variant', attributes: VARIANT_SUMMARY_ATTRIBUTES, required: false };
const orderInclude = { model: Order, as: 'order', attributes: ORDER_SUMMARY_ATTRIBUTES, required: false };
const sourceWarehouseInclude = { model: Warehouse, as: 'sourceWarehouse', attributes: WAREHOUSE_SUMMARY_ATTRIBUTES, required: false };
const targetWarehouseInclude = { model: Warehouse, as: 'targetWarehouse', attributes: WAREHOUSE_SUMMARY_ATTRIBUTES, required: false };
const sourceLocationInclude = { model: Location, as: 'sourceLocation', attributes: LOCATION_SUMMARY_ATTRIBUTES, required: false };
const targetLocationInclude = { model: Location, as: 'targetLocation', attributes: LOCATION_SUMMARY_ATTRIBUTES, required: false };
const itemLocationInclude = { model: Location, as: 'location', attributes: LOCATION_SUMMARY_ATTRIBUTES, required: false };
const fromLocationInclude = { model: Location, as: 'fromLocation', attributes: LOCATION_SUMMARY_ATTRIBUTES, required: false };
const toLocationInclude = { model: Location, as: 'toLocation', attributes: LOCATION_SUMMARY_ATTRIBUTES, required: false };

const stockMoveIncludes = [
  warehouseInclude,
  productInclude,
  variantInclude,
  fromLocationInclude,
  toLocationInclude,
];

function toPlain(value) {
  if (!value) return null;
  if (typeof value.toJSON === 'function') return value.toJSON();
  return value;
}

function pickSummary(value, fields, fallback = {}) {
  const row = toPlain(value);
  if (!row) return null;
  return fields.reduce((acc, field) => {
    acc[field] = row[field] ?? fallback[field] ?? null;
    return acc;
  }, {});
}

function summarizeWarehouse(value) {
  return pickSummary(value, ['id', 'code', 'name']);
}

function summarizeLocation(value) {
  const row = toPlain(value);
  if (!row) return null;
  return {
    id: row.id ?? null,
    code: row.code ?? null,
    name: row.name ?? row.type ?? null,
  };
}

function summarizeProduct(value) {
  return pickSummary(value, ['id', 'sku', 'name']);
}

function summarizeVariant(value) {
  const row = toPlain(value);
  if (!row) return null;
  return {
    id: row.id ?? null,
    sku: row.sku ?? null,
    name: row.name ?? null,
  };
}

function summarizeOrder(value) {
  return pickSummary(value, ['id', 'number', 'status']);
}

function summarizeDocument(value) {
  return pickSummary(value, ['id', 'number', 'status']);
}

function enrichProductVariantItem(row) {
  const item = toPlain(row);
  if (!item) return item;
  return {
    ...item,
    product: summarizeProduct(item.product),
    variant: summarizeVariant(item.variant),
  };
}

function enrichAdjustmentItem(row) {
  const item = enrichProductVariantItem(row);
  if (!item) return item;
  return {
    ...item,
    location: summarizeLocation(item.location),
  };
}

function enrichReceiptDto(row) {
  const dto = toPlain(row);
  if (!dto) return dto;
  return {
    ...dto,
    warehouse: summarizeWarehouse(dto.warehouse),
    inboundLocation: summarizeLocation(dto.inboundLocation),
    parentDocument: summarizeDocument(dto.parentDocument),
    correctedBy: summarizeDocument(dto.correctedBy),
    items: Array.isArray(dto.items) ? dto.items.map(enrichProductVariantItem) : dto.items,
  };
}

function enrichShipmentDto(row) {
  const dto = toPlain(row);
  if (!dto) return dto;
  return {
    ...dto,
    warehouse: summarizeWarehouse(dto.warehouse),
    order: summarizeOrder(dto.order),
    parentDocument: summarizeDocument(dto.parentDocument),
    correctedBy: summarizeDocument(dto.correctedBy),
    items: Array.isArray(dto.items) ? dto.items.map(enrichProductVariantItem) : dto.items,
  };
}

function enrichTransferDto(row, relationOverrides = {}) {
  const dto = toPlain(row);
  if (!dto) return dto;
  const sourceLocation = summarizeLocation(relationOverrides.sourceLocation || dto.sourceLocation);
  const targetLocation = summarizeLocation(relationOverrides.targetLocation || dto.targetLocation);
  return {
    ...dto,
    sourceWarehouse: summarizeWarehouse(dto.sourceWarehouse),
    targetWarehouse: summarizeWarehouse(dto.targetWarehouse),
    sourceLocationId: dto.sourceLocationId || sourceLocation?.id || null,
    targetLocationId: dto.targetLocationId || targetLocation?.id || null,
    sourceLocation,
    targetLocation,
    items: Array.isArray(dto.items) ? dto.items.map(enrichProductVariantItem) : dto.items,
  };
}

function enrichAdjustmentDto(row) {
  const dto = toPlain(row);
  if (!dto) return dto;
  return {
    ...dto,
    warehouse: summarizeWarehouse(dto.warehouse),
    items: Array.isArray(dto.items) ? dto.items.map(enrichAdjustmentItem) : dto.items,
  };
}

function enrichCycleCountItem(row) {
  const item = enrichProductVariantItem(row);
  if (!item) return item;
  return {
    ...item,
    location: summarizeLocation(item.location),
  };
}

function enrichCycleCountDto(row) {
  const dto = toPlain(row);
  if (!dto) return dto;
  return {
    ...dto,
    warehouse: summarizeWarehouse(dto.warehouse),
    items: Array.isArray(dto.items) ? dto.items.map(enrichCycleCountItem) : dto.items,
  };
}

function enrichStockMoveDto(row) {
  const dto = toPlain(row);
  if (!dto) return dto;
  return {
    ...dto,
    warehouse: summarizeWarehouse(dto.warehouse),
    product: summarizeProduct(dto.product),
    variant: summarizeVariant(dto.variant),
    fromLocation: summarizeLocation(dto.fromLocation),
    toLocation: summarizeLocation(dto.toLocation),
  };
}

function enrichStockMoveRows(rows = []) {
  return rows.map(enrichStockMoveDto);
}

async function resolveTransferMoveLocations({ companyId, transferId, transaction }) {
  if (!companyId || !transferId) return {};
  const moves = await StockMove.findAll({
    where: { companyId, refType: 'MM', refId: transferId, type: 'transfer' },
    include: [fromLocationInclude, toLocationInclude],
    attributes: ['id', 'fromLocationId', 'toLocationId'],
    transaction,
  });
  const sourceRows = moves
    .filter((move) => move.fromLocationId && move.fromLocation)
    .map((move) => move.fromLocation);
  const targetRows = moves
    .filter((move) => move.toLocationId && move.toLocation)
    .map((move) => move.toLocation);
  const sourceIds = new Set(sourceRows.map((row) => row.id));
  const targetIds = new Set(targetRows.map((row) => row.id));
  return {
    sourceLocation: sourceIds.size === 1 ? sourceRows[0] : null,
    targetLocation: targetIds.size === 1 ? targetRows[0] : null,
  };
}

module.exports = {
  inboundLocationInclude,
  itemLocationInclude,
  orderInclude,
  productInclude,
  sourceLocationInclude,
  sourceWarehouseInclude,
  stockMoveIncludes,
  targetLocationInclude,
  targetWarehouseInclude,
  variantInclude,
  warehouseInclude,
  enrichAdjustmentDto,
  enrichCycleCountDto,
  enrichReceiptDto,
  enrichShipmentDto,
  enrichStockMoveDto,
  enrichStockMoveRows,
  enrichTransferDto,
  resolveTransferMoveLocations,
};
