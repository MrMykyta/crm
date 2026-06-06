'use strict';

const { Op, fn, col } = require('sequelize');
const { InventoryItem, Reservation, Warehouse, Product, ProductVariant } = require('../../models');

function asText(value) {
  return String(value ?? '').trim();
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function asOptionalUuid(value) {
  const text = asText(value);
  return text || null;
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return defaultValue;
  const normalized = asText(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function buildKey(warehouseId, productId, variantId) {
  return `${warehouseId}|${productId}|${variantId || '__null__'}`;
}

function matchesSearch(row, normalizedSearch) {
  if (!normalizedSearch) return true;
  const haystack = [
    row.productName,
    row.productSku,
    row.variantName,
    row.warehouseCode,
  ]
    .map((value) => asText(value).toLowerCase())
    .join(' ');
  return haystack.includes(normalizedSearch);
}

async function listStockBalances(companyId, filters = {}, options = {}) {
  const safeCompanyId = asText(companyId);
  if (!safeCompanyId) return [];

  const transaction = options.transaction || null;
  const warehouseId = asOptionalUuid(filters.warehouseId);
  const productId = asOptionalUuid(filters.productId);
  const variantFilterRaw = filters.variantId;
  const variantId = variantFilterRaw === null || variantFilterRaw === undefined || variantFilterRaw === ''
    ? null
    : asOptionalUuid(variantFilterRaw);
  const search = asText(filters.search).toLowerCase();
  const onlyPositive = parseBoolean(filters.onlyPositive, false);

  const inventoryWhere = { companyId: safeCompanyId };
  if (warehouseId) inventoryWhere.warehouseId = warehouseId;
  if (productId) inventoryWhere.productId = productId;
  if (variantId) inventoryWhere.variantId = variantId;

  const reservationWhere = {
    companyId: safeCompanyId,
    status: 'active',
  };
  if (warehouseId) reservationWhere.warehouseId = warehouseId;
  if (productId) reservationWhere.productId = productId;
  if (variantId) reservationWhere.variantId = variantId;

  const [onHandRows, reservedRows] = await Promise.all([
    InventoryItem.findAll({
      where: inventoryWhere,
      attributes: [
        'warehouseId',
        'productId',
        'variantId',
        [fn('SUM', col('qty_on_hand')), 'onHand'],
      ],
      group: ['warehouse_id', 'product_id', 'variant_id'],
      transaction,
      raw: true,
    }),
    Reservation.findAll({
      where: reservationWhere,
      attributes: [
        'warehouseId',
        'productId',
        'variantId',
        [fn('SUM', col('qty')), 'reserved'],
      ],
      group: ['warehouse_id', 'product_id', 'variant_id'],
      transaction,
      raw: true,
    }),
  ]);

  const reservedByKey = new Map();
  for (const row of reservedRows) {
    const key = buildKey(row.warehouseId, row.productId, row.variantId || null);
    reservedByKey.set(key, round4(asNumber(row.reserved, 0)));
  }

  const rowsByKey = new Map();
  onHandRows.forEach((row) => {
    const key = buildKey(row.warehouseId, row.productId, row.variantId || null);
    rowsByKey.set(key, {
      warehouseId: row.warehouseId,
      productId: row.productId,
      variantId: row.variantId || null,
      onHand: round4(asNumber(row.onHand, 0)),
      reserved: 0,
    });
  });
  reservedRows.forEach((row) => {
    const key = buildKey(row.warehouseId, row.productId, row.variantId || null);
    const base = rowsByKey.get(key) || {
      warehouseId: row.warehouseId,
      productId: row.productId,
      variantId: row.variantId || null,
      onHand: 0,
      reserved: 0,
    };
    base.reserved = round4(asNumber(row.reserved, 0));
    rowsByKey.set(key, base);
  });

  const groupedRows = Array.from(rowsByKey.values());
  const warehouseIds = [...new Set(groupedRows.map((row) => row.warehouseId).filter(Boolean))];
  const productIds = [...new Set(groupedRows.map((row) => row.productId).filter(Boolean))];
  const variantIds = [...new Set(groupedRows.map((row) => row.variantId).filter(Boolean))];

  const [warehouses, products, variants] = await Promise.all([
    warehouseIds.length
      ? Warehouse.findAll({
        where: { id: { [Op.in]: warehouseIds }, companyId: safeCompanyId },
        attributes: ['id', 'code', 'name'],
        transaction,
        raw: true,
      })
      : [],
    productIds.length
      ? Product.findAll({
        where: { id: { [Op.in]: productIds }, companyId: safeCompanyId },
        attributes: ['id', 'name', 'sku'],
        transaction,
        raw: true,
      })
      : [],
    variantIds.length
      ? ProductVariant.findAll({
        where: { id: { [Op.in]: variantIds }, companyId: safeCompanyId },
        attributes: ['id', 'sku'],
        transaction,
        raw: true,
      })
      : [],
  ]);

  const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
  const productById = new Map(products.map((row) => [row.id, row]));
  const variantById = new Map(variants.map((row) => [row.id, row]));

  const rows = groupedRows
    .map((row) => {
      const reserved = round4(asNumber(row.reserved ?? reservedByKey.get(
        buildKey(row.warehouseId, row.productId, row.variantId || null)
      ), 0));
      const onHand = round4(asNumber(row.onHand, 0));
      const available = round4(onHand - reserved);

      const warehouse = warehouseById.get(row.warehouseId) || {};
      const product = productById.get(row.productId) || {};
      const variant = row.variantId ? variantById.get(row.variantId) || {} : {};

      return {
        warehouseId: row.warehouseId,
        warehouseCode: warehouse.code || null,
        warehouseName: warehouse.name || null,
        productId: row.productId,
        productName: product.name || null,
        productSku: product.sku || null,
        variantId: row.variantId || null,
        variantName: variant.sku || null,
        onHand,
        reserved,
        available,
      };
    })
    .filter((row) => matchesSearch(row, search))
    .filter((row) => {
      if (!onlyPositive) return true;
      return !(row.onHand === 0 && row.reserved === 0);
    });

  return rows;
}

module.exports = {
  listStockBalances,
};
