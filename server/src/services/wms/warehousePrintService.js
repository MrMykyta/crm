'use strict';

const {
  Adjustment,
  AdjustmentItem,
  CountItem,
  CycleCount,
  Location,
  Product,
  ProductVariant,
  Receipt,
  ReceiptItem,
  Shipment,
  ShipmentItem,
  TransferItem,
  TransferOrder,
  Warehouse,
} = require('../../models');

const DOC_CONFIG = {
  receipt: { model: Receipt, itemModel: ReceiptItem, itemAlias: 'items', documentType: 'PZ' },
  shipment: { model: Shipment, itemModel: ShipmentItem, itemAlias: 'items', documentType: 'WZ' },
  transfer: { model: TransferOrder, itemModel: TransferItem, itemAlias: 'items', documentType: 'MM' },
  adjustment: { model: Adjustment, itemModel: AdjustmentItem, itemAlias: 'items', documentType: null },
  cycleCount: { model: CycleCount, itemModel: CountItem, itemAlias: 'items', documentType: 'COUNT' },
};

function asText(value) {
  return String(value ?? '').trim();
}

function asNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function byId(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row?.id) map.set(row.id, row);
  });
  return map;
}

function summaryWarehouse(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code || null,
    name: row.name || null,
    label: [row.code, row.name].filter(Boolean).join(' - ') || row.id,
  };
}

function summaryLocation(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code || null,
    type: row.type || null,
    label: [row.code, row.type].filter(Boolean).join(' - ') || row.id,
  };
}

function summaryProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku || null,
    name: row.name || null,
    label: [row.sku, row.name].filter(Boolean).join(' - ') || row.id,
  };
}

function summaryVariant(row) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku || null,
    label: row.sku || row.id,
  };
}

async function loadLookups(companyId, document, items, kind, transaction) {
  const warehouseIds = new Set();
  const locationIds = new Set();
  const productIds = new Set();
  const variantIds = new Set();

  ['warehouseId', 'fromWarehouseId', 'toWarehouseId'].forEach((field) => {
    if (document?.[field]) warehouseIds.add(document[field]);
  });
  items.forEach((item) => {
    if (item?.warehouseId) warehouseIds.add(item.warehouseId);
    ['locationId', 'fromLocationId', 'toLocationId'].forEach((field) => {
      if (item?.[field]) locationIds.add(item[field]);
    });
    if (kind === 'receipt' && document?.inboundLocationId) locationIds.add(document.inboundLocationId);
    if (item?.productId) productIds.add(item.productId);
    if (item?.variantId) variantIds.add(item.variantId);
  });

  const [warehouses, locations, products, variants] = await Promise.all([
    warehouseIds.size
      ? Warehouse.findAll({ where: { companyId, id: Array.from(warehouseIds) }, transaction })
      : [],
    locationIds.size
      ? Location.findAll({ where: { companyId, id: Array.from(locationIds) }, transaction })
      : [],
    productIds.size
      ? Product.findAll({ where: { companyId, id: Array.from(productIds) }, transaction })
      : [],
    variantIds.size
      ? ProductVariant.findAll({ where: { companyId, id: Array.from(variantIds) }, transaction })
      : [],
  ]);

  return {
    warehouses: byId(warehouses),
    locations: byId(locations),
    products: byId(products),
    variants: byId(variants),
  };
}

function qtyFor(kind, item) {
  if (kind === 'receipt') return item.qtyReceived ?? item.qtyExpected;
  if (kind === 'adjustment') return item.qtyDelta;
  if (kind === 'cycleCount') return item.qtyCounted;
  return item.qty;
}

function plannedQtyFor(kind, item) {
  if (kind === 'receipt') return item.qtyExpected;
  if (kind === 'transfer') return item.qty;
  if (kind === 'shipment') return item.qty;
  return null;
}

function processedQtyFor(kind, item) {
  if (kind === 'receipt') return item.qtyReceived;
  if (kind === 'transfer') return item.movedQty;
  return null;
}

function mapItem(kind, item, lookups, document) {
  const product = lookups.products.get(item.productId);
  const variant = item.variantId ? lookups.variants.get(item.variantId) : null;
  const locationId = item.locationId || (kind === 'receipt' ? document.inboundLocationId : null);

  return {
    id: item.id,
    productId: item.productId,
    product: summaryProduct(product),
    variantId: item.variantId || null,
    variant: summaryVariant(variant),
    locationId: locationId || null,
    location: summaryLocation(locationId ? lookups.locations.get(locationId) : null),
    lotId: item.lotId || null,
    lotNumber: item.lotNumber || null,
    serialId: item.serialId || null,
    serialNumber: item.serialNumber || null,
    qty: asNumber(qtyFor(kind, item), 0),
    plannedQty: plannedQtyFor(kind, item) === null ? null : asNumber(plannedQtyFor(kind, item), 0),
    processedQty: processedQtyFor(kind, item) === null ? null : asNumber(processedQtyFor(kind, item), 0),
  };
}

function mapHeader(kind, document, lookups) {
  const documentType = kind === 'adjustment'
    ? asText(document.documentType || 'RW/PW')
    : DOC_CONFIG[kind].documentType;

  return {
    id: document.id,
    kind,
    documentType,
    title: documentType,
    number: document.number || null,
    status: document.status || null,
    issueDate: document.issueDate || document.createdAt || null,
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
    postedAt: document.postedAt || null,
    reason: document.reason || null,
    orderId: document.orderId || null,
    warehouseId: document.warehouseId || null,
    warehouse: summaryWarehouse(document.warehouseId ? lookups.warehouses.get(document.warehouseId) : null),
    fromWarehouseId: document.fromWarehouseId || null,
    fromWarehouse: summaryWarehouse(document.fromWarehouseId ? lookups.warehouses.get(document.fromWarehouseId) : null),
    toWarehouseId: document.toWarehouseId || null,
    toWarehouse: summaryWarehouse(document.toWarehouseId ? lookups.warehouses.get(document.toWarehouseId) : null),
  };
}

async function getPrintDocument(companyId, kind, id, options = {}) {
  const config = DOC_CONFIG[kind];
  if (!config || !companyId || !id) return null;

  const transaction = options.transaction || null;
  const document = await config.model.findOne({
    where: { id, companyId },
    include: [{ model: config.itemModel, as: config.itemAlias }],
    order: [[{ model: config.itemModel, as: config.itemAlias }, 'createdAt', 'ASC']],
    transaction,
  });
  if (!document) return null;

  const items = Array.isArray(document.items) ? document.items : [];
  const lookups = await loadLookups(companyId, document, items, kind, transaction);
  const mappedItems = items.map((item) => mapItem(kind, item, lookups, document));

  return {
    header: mapHeader(kind, document, lookups),
    items: mappedItems,
    totals: {
      itemsCount: mappedItems.length,
      qtyTotal: mappedItems.reduce((sum, item) => sum + asNumber(item.qty, 0), 0),
      plannedQtyTotal: mappedItems.reduce((sum, item) => sum + asNumber(item.plannedQty, 0), 0),
      processedQtyTotal: mappedItems.reduce((sum, item) => sum + asNumber(item.processedQty, 0), 0),
    },
  };
}

module.exports = {
  getPrintDocument,
};
