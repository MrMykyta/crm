'use strict';

const { QueryTypes } = require('sequelize');
const AppError = require('../../errors/AppError');
const { StockMove } = require('../../models');

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

function validationError(message, details) {
  return new AppError(400, message, { code: 'VALIDATION_ERROR', details });
}

function parseAsOf(value) {
  const text = asText(value);
  if (!text) {
    throw validationError('asOf is required', { field: 'asOf' });
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = new Date(dateOnly ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError('asOf is invalid', { field: 'asOf', value: text });
  }

  const exclusive = new Date(parsed.getTime());
  exclusive.setTime(exclusive.getTime() + (dateOnly ? 24 * 60 * 60 * 1000 : 1));
  return exclusive;
}

function buildGroup(groupBy) {
  if (groupBy === 'warehouse') {
    return {
      select: `
        smx.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        NULL::uuid AS "productId",
        NULL::text AS "productName",
        NULL::text AS "productSku",
        NULL::uuid AS "variantId",
        NULL::text AS "variantName",
        NULL::text AS "variantSku",
        smx.currency AS "currency"
      `,
      group: 'smx.warehouse_id, w.code, w.name, smx.currency',
      order: 'w.code ASC NULLS LAST, w.name ASC NULLS LAST, smx.currency ASC',
    };
  }

  if (groupBy === 'productWarehouse') {
    return {
      select: `
        smx.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        smx.product_id AS "productId",
        p.name AS "productName",
        p.sku AS "productSku",
        smx.variant_id AS "variantId",
        pv.sku AS "variantName",
        pv.sku AS "variantSku",
        smx.currency AS "currency"
      `,
      group: 'smx.warehouse_id, w.code, w.name, smx.product_id, p.name, p.sku, smx.variant_id, pv.sku, smx.currency',
      order: 'p.name ASC NULLS LAST, p.sku ASC NULLS LAST, w.code ASC NULLS LAST, smx.currency ASC',
    };
  }

  return {
    select: `
      NULL::uuid AS "warehouseId",
      NULL::text AS "warehouseCode",
      NULL::text AS "warehouseName",
      smx.product_id AS "productId",
      p.name AS "productName",
      p.sku AS "productSku",
      smx.variant_id AS "variantId",
      pv.sku AS "variantName",
      pv.sku AS "variantSku",
      smx.currency AS "currency"
    `,
    group: 'smx.product_id, p.name, p.sku, smx.variant_id, pv.sku, smx.currency',
    order: 'p.name ASC NULLS LAST, p.sku ASC NULLS LAST, smx.currency ASC',
  };
}

function buildWhere(filters, replacements) {
  const where = [
    'sm.company_id = :companyId',
    'sm.created_at < :asOfExclusive',
  ];

  if (filters.warehouseId) {
    where.push('sm.warehouse_id = :warehouseId');
    replacements.warehouseId = filters.warehouseId;
  }
  if (filters.productId) {
    where.push('sm.product_id = :productId');
    replacements.productId = filters.productId;
  }
  if (filters.variantId) {
    where.push('sm.variant_id = :variantId');
    replacements.variantId = filters.variantId;
  }
  if (filters.currency) {
    where.push('COALESCE(sm.currency, :currency) = :currency');
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
    qty: round4(row.qty),
    stockValue: round2(row.stockValue),
    currency: row.currency || null,
  };
}

async function listStockAsOf(companyId, query = {}, options = {}) {
  ensureCompanyId(companyId);

  const asOfExclusive = parseAsOf(query.asOf);
  const groupBy = GROUP_BY.has(query.groupBy) ? query.groupBy : 'product';
  const filters = {
    warehouseId: asText(query.warehouseId) || null,
    productId: asText(query.productId) || null,
    variantId: asText(query.variantId) || null,
    currency: normalizeCurrency(query.currency),
  };

  const replacements = { companyId, asOfExclusive };
  const where = buildWhere(filters, replacements);
  const group = buildGroup(groupBy);

  const rows = await StockMove.sequelize.query(
    `
    WITH signed_moves AS (
      SELECT
        sm.warehouse_id,
        sm.product_id,
        sm.variant_id,
        COALESCE(sm.currency, :defaultCurrency) AS currency,
        CASE
          WHEN sm.type = 'receipt' AND sm.ref_type = 'PZ' THEN ABS(sm.qty)::numeric
          WHEN sm.type = 'adjustment' AND sm.ref_type = 'PW' THEN ABS(sm.qty)::numeric
          WHEN sm.type = 'transfer' AND sm.ref_type = 'MM' AND sm.to_location_id IS NOT NULL THEN ABS(sm.qty)::numeric
          WHEN sm.type = 'ship' AND sm.ref_type = 'WZ' THEN -ABS(sm.qty)::numeric
          WHEN sm.type = 'adjustment' AND sm.ref_type = 'RW' THEN -ABS(sm.qty)::numeric
          WHEN sm.type = 'transfer' AND sm.ref_type = 'MM' AND sm.from_location_id IS NOT NULL THEN -ABS(sm.qty)::numeric
          -- K1.8: correction reverse moves participate in the asOf reconstruction:
          -- WZ_KOREKTA puts qty back on the warehouse, PZ_KOREKTA removes it.
          WHEN sm.type = 'receipt' AND sm.ref_type = 'WZ_KOREKTA' THEN ABS(sm.qty)::numeric
          WHEN sm.type = 'ship' AND sm.ref_type = 'PZ_KOREKTA' THEN -ABS(sm.qty)::numeric
          ELSE NULL
        END AS signed_qty,
        CASE
          WHEN sm.type = 'receipt' AND sm.ref_type = 'PZ' THEN ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric
          WHEN sm.type = 'adjustment' AND sm.ref_type = 'PW' THEN ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric
          WHEN sm.type = 'transfer' AND sm.ref_type = 'MM' AND sm.to_location_id IS NOT NULL THEN ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric
          WHEN sm.type = 'ship' AND sm.ref_type = 'WZ' THEN -ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric
          WHEN sm.type = 'adjustment' AND sm.ref_type = 'RW' THEN -ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric
          WHEN sm.type = 'transfer' AND sm.ref_type = 'MM' AND sm.from_location_id IS NOT NULL THEN -ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric
          -- K1.8: same direction for value as for qty.
          WHEN sm.type = 'receipt' AND sm.ref_type = 'WZ_KOREKTA' THEN ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric
          WHEN sm.type = 'ship' AND sm.ref_type = 'PZ_KOREKTA' THEN -ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric
          ELSE NULL
        END AS signed_value
      FROM stock_moves sm
      WHERE ${where}
    )
    SELECT
      ${group.select},
      SUM(smx.signed_qty)::numeric AS "qty",
      SUM(smx.signed_value)::numeric AS "stockValue"
    FROM signed_moves smx
    LEFT JOIN warehouses w
      ON w.id = smx.warehouse_id
     AND w.company_id = :companyId
    LEFT JOIN products p
      ON p.id = smx.product_id
     AND p.company_id = :companyId
    LEFT JOIN product_variants pv
      ON pv.id = smx.variant_id
     AND pv.company_id = :companyId
    WHERE smx.signed_qty IS NOT NULL
    GROUP BY ${group.group}
    HAVING SUM(smx.signed_qty) <> 0 OR SUM(smx.signed_value) <> 0
    ORDER BY ${group.order}
    `,
    {
      replacements: {
        ...replacements,
        defaultCurrency: filters.currency || 'PLN',
      },
      transaction: options.transaction || null,
      type: QueryTypes.SELECT,
    }
  );

  const data = rows.map(mapRow);
  const currencySet = new Set(data.map((row) => row.currency).filter(Boolean));
  const totals = {
    qty: round4(data.reduce((sum, row) => sum + Number(row.qty || 0), 0)),
    stockValue: round2(data.reduce((sum, row) => sum + Number(row.stockValue || 0), 0)),
    currency: filters.currency || (currencySet.size === 1 ? [...currencySet][0] : (currencySet.size > 1 ? 'MIXED' : null)),
  };

  return { data, totals };
}

module.exports = {
  listStockAsOf,
};
