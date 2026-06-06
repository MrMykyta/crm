'use strict';

const { QueryTypes } = require('sequelize');
const AppError = require('../../errors/AppError');
const { CostLayer } = require('../../models');

const GROUP_BY = new Set(['product', 'warehouse', 'productWarehouse']);

function ensureCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeCurrency(value) {
  const text = asText(value).toUpperCase();
  return text || null;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function buildGroup(groupBy) {
  if (groupBy === 'warehouse') {
    return {
      select: `
        cl.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        NULL::uuid AS "productId",
        NULL::text AS "productName",
        NULL::text AS "productSku",
        NULL::uuid AS "variantId",
        NULL::text AS "variantName",
        NULL::text AS "variantSku",
        cl.currency AS "currency"
      `,
      group: 'cl.warehouse_id, w.code, w.name, cl.currency',
      order: 'w.code ASC NULLS LAST, w.name ASC NULLS LAST, cl.currency ASC',
    };
  }

  if (groupBy === 'productWarehouse') {
    return {
      select: `
        cl.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        cl.product_id AS "productId",
        p.name AS "productName",
        p.sku AS "productSku",
        cl.variant_id AS "variantId",
        pv.sku AS "variantName",
        pv.sku AS "variantSku",
        cl.currency AS "currency"
      `,
      group: 'cl.warehouse_id, w.code, w.name, cl.product_id, p.name, p.sku, cl.variant_id, pv.sku, cl.currency',
      order: 'p.name ASC NULLS LAST, p.sku ASC NULLS LAST, w.code ASC NULLS LAST, cl.currency ASC',
    };
  }

  return {
    select: `
      NULL::uuid AS "warehouseId",
      NULL::text AS "warehouseCode",
      NULL::text AS "warehouseName",
      cl.product_id AS "productId",
      p.name AS "productName",
      p.sku AS "productSku",
      cl.variant_id AS "variantId",
      pv.sku AS "variantName",
      pv.sku AS "variantSku",
      cl.currency AS "currency"
    `,
    group: 'cl.product_id, p.name, p.sku, cl.variant_id, pv.sku, cl.currency',
    order: 'p.name ASC NULLS LAST, p.sku ASC NULLS LAST, cl.currency ASC',
  };
}

function buildWhere(filters, replacements) {
  const where = [
    'cl.company_id = :companyId',
    'cl.qty_remaining > 0',
  ];

  if (filters.warehouseId) {
    where.push('cl.warehouse_id = :warehouseId');
    replacements.warehouseId = filters.warehouseId;
  }
  if (filters.productId) {
    where.push('cl.product_id = :productId');
    replacements.productId = filters.productId;
  }
  if (filters.variantId) {
    where.push('cl.variant_id = :variantId');
    replacements.variantId = filters.variantId;
  }
  if (filters.currency) {
    where.push('cl.currency = :currency');
    replacements.currency = filters.currency;
  }

  return where.join('\n      AND ');
}

function mapRow(row) {
  return {
    warehouseId: row.warehouseId || null,
    warehouseCode: row.warehouseCode || null,
    warehouseName: row.warehouseName || null,
    productId: row.productId || null,
    productName: row.productName || null,
    productSku: row.productSku || null,
    variantId: row.variantId || null,
    variantName: row.variantName || null,
    variantSku: row.variantSku || null,
    qtyRemaining: round4(row.qtyRemaining),
    stockValue: round2(row.stockValue),
    currency: row.currency || null,
  };
}

async function listStockValuation(companyId, query = {}, options = {}) {
  ensureCompanyId(companyId);

  if (asText(query.asOf)) {
    throw new AppError(409, 'asOf stock valuation is not implemented yet', {
      code: 'NOT_IMPLEMENTED',
      details: { field: 'asOf' },
    });
  }

  const groupBy = GROUP_BY.has(query.groupBy) ? query.groupBy : 'product';
  const filters = {
    warehouseId: asText(query.warehouseId) || null,
    productId: asText(query.productId) || null,
    variantId: asText(query.variantId) || null,
    currency: normalizeCurrency(query.currency),
  };

  const replacements = { companyId };
  const where = buildWhere(filters, replacements);
  const group = buildGroup(groupBy);

  const rows = await CostLayer.sequelize.query(
    `
    SELECT
      ${group.select},
      SUM(cl.qty_remaining)::numeric AS "qtyRemaining",
      SUM(cl.qty_remaining * cl.unit_cost)::numeric AS "stockValue"
    FROM cost_layers cl
    LEFT JOIN warehouses w
      ON w.id = cl.warehouse_id
     AND w.company_id = cl.company_id
    LEFT JOIN products p
      ON p.id = cl.product_id
     AND p.company_id = cl.company_id
    LEFT JOIN product_variants pv
      ON pv.id = cl.variant_id
     AND pv.company_id = cl.company_id
    WHERE ${where}
    GROUP BY ${group.group}
    ORDER BY ${group.order}
    `,
    {
      replacements,
      transaction: options.transaction || null,
      type: QueryTypes.SELECT,
    }
  );

  const data = rows.map(mapRow);
  const currencySet = new Set(data.map((row) => row.currency).filter(Boolean));
  const totals = {
    qtyRemaining: round4(data.reduce((sum, row) => sum + Number(row.qtyRemaining || 0), 0)),
    stockValue: round2(data.reduce((sum, row) => sum + Number(row.stockValue || 0), 0)),
    currency: filters.currency || (currencySet.size === 1 ? [...currencySet][0] : (currencySet.size > 1 ? 'MIXED' : null)),
  };

  return { data, totals };
}

module.exports = {
  listStockValuation,
};
