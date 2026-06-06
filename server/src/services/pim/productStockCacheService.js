'use strict';

const { QueryTypes } = require('sequelize');
const AppError = require('../../errors/AppError');
const { sequelize, Product } = require('../../models');

function asNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round3(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e3) / 1e3;
}

function assertCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });
  }
}

function normalizeProductIds(productIds) {
  if (!Array.isArray(productIds)) return [];
  const unique = new Set();
  for (const id of productIds) {
    const normalized = String(id || '').trim();
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}

async function loadOnHandByProduct(companyId, productIds, transaction) {
  const filterByProducts = productIds.length
    ? 'AND product_id IN (:productIds)'
    : '';

  const rows = await sequelize.query(
    `
      SELECT
        product_id AS "productId",
        COALESCE(SUM(qty_on_hand), 0) AS "onHand"
      FROM inventory_items
      WHERE company_id = :companyId
      ${filterByProducts}
      GROUP BY product_id
    `,
    {
      replacements: {
        companyId,
        productIds: productIds.length ? productIds : null,
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  const map = new Map();
  for (const row of rows) {
    map.set(String(row.productId), round3(asNumber(row.onHand, 0)));
  }
  return map;
}

async function loadReservedByProduct(companyId, productIds, transaction) {
  const filterByProducts = productIds.length
    ? 'AND product_id IN (:productIds)'
    : '';

  const rows = await sequelize.query(
    `
      SELECT
        product_id AS "productId",
        COALESCE(SUM(qty), 0) AS "reserved"
      FROM reservations
      WHERE company_id = :companyId
        AND status = 'active'
        ${filterByProducts}
      GROUP BY product_id
    `,
    {
      replacements: {
        companyId,
        productIds: productIds.length ? productIds : null,
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  const map = new Map();
  for (const row of rows) {
    map.set(String(row.productId), round3(asNumber(row.reserved, 0)));
  }
  return map;
}

async function recalcProductsStock(companyId, productIds, options = {}) {
  assertCompanyId(companyId);
  const transaction = options.transaction || null;
  const ids = normalizeProductIds(productIds);
  if (!ids.length) return { updatedCount: 0, items: [] };

  const products = await Product.findAll({
    where: { companyId, id: ids },
    attributes: ['id', 'stockQuantity', 'reservedQuantity'],
    transaction,
  });

  if (!products.length) return { updatedCount: 0, items: [] };

  const existingIds = products.map((row) => String(row.id));
  const [onHandMap, reservedMap] = await Promise.all([
    loadOnHandByProduct(companyId, existingIds, transaction),
    loadReservedByProduct(companyId, existingIds, transaction),
  ]);

  const items = [];
  let updatedCount = 0;

  for (const product of products) {
    const productId = String(product.id);
    const stockQuantity = round3(asNumber(onHandMap.get(productId), 0));
    const reservedQuantity = round3(asNumber(reservedMap.get(productId), 0));
    const prevStock = round3(asNumber(product.stockQuantity, 0));
    const prevReserved = round3(asNumber(product.reservedQuantity, 0));
    const changed = prevStock !== stockQuantity || prevReserved !== reservedQuantity;

    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await product.update({ stockQuantity, reservedQuantity }, { transaction });
      updatedCount += 1;
    }

    items.push({
      productId,
      stockQuantity,
      reservedQuantity,
      changed,
    });
  }

  return { updatedCount, items };
}

async function recalcProductStock(companyId, productId, options = {}) {
  assertCompanyId(companyId);
  const normalized = String(productId || '').trim();
  if (!normalized) {
    throw new AppError(400, 'productId is required', { code: 'VALIDATION_ERROR' });
  }

  const result = await recalcProductsStock(companyId, [normalized], options);
  return result.items[0] || {
    productId: normalized,
    stockQuantity: 0,
    reservedQuantity: 0,
    changed: false,
  };
}

async function recalcAllProductsStock(companyId, options = {}) {
  assertCompanyId(companyId);
  const transaction = options.transaction || null;

  const productRows = await Product.findAll({
    where: { companyId },
    attributes: ['id'],
    transaction,
  });

  const productIds = productRows.map((row) => String(row.id));
  if (!productIds.length) return { updatedCount: 0, items: [] };

  return recalcProductsStock(companyId, productIds, { transaction });
}

module.exports = {
  recalcProductStock,
  recalcProductsStock,
  recalcAllProductsStock,
};
