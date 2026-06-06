'use strict';

const { QueryTypes } = require('sequelize');
const AppError = require('../../errors/AppError');
const { StockMove } = require('../../models');

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

function parseDateBoundary(value, field, isEnd = false) {
  const text = asText(value);
  if (!text) {
    throw validationError(`${field} is required`, { field });
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = new Date(dateOnly ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError(`${field} is invalid`, { field, value: text });
  }

  if (isEnd) {
    const exclusive = new Date(parsed.getTime());
    exclusive.setTime(exclusive.getTime() + (dateOnly ? 24 * 60 * 60 * 1000 : 1));
    return exclusive;
  }

  return parsed;
}

function normalizeDateRange(query) {
  const dateFrom = parseDateBoundary(query.dateFrom, 'dateFrom');
  const dateToExclusive = parseDateBoundary(query.dateTo, 'dateTo', true);

  if (dateFrom >= dateToExclusive) {
    throw validationError('dateFrom must be before dateTo', {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  return { dateFrom, dateToExclusive };
}

function buildWhere(filters, replacements) {
  const where = [
    'sm.company_id = :companyId',
    'sm.product_id = :productId',
    'sm.created_at >= :dateFrom',
    'sm.created_at < :dateToExclusive',
  ];

  replacements.productId = filters.productId;

  if (filters.variantId) {
    where.push('sm.variant_id = :variantId');
    replacements.variantId = filters.variantId;
  }
  if (filters.warehouseId) {
    where.push('sm.warehouse_id = :warehouseId');
    replacements.warehouseId = filters.warehouseId;
  }
  if (filters.currency) {
    where.push('COALESCE(sm.currency, :currency) = :currency');
    replacements.currency = filters.currency;
  }

  return where.join('\n      AND ');
}

function mapRow(row) {
  return {
    id: row.id,
    date: row.date,
    documentType: row.documentType || null,
    documentNumber: row.documentNumber || null,
    refType: row.refType || null,
    refId: row.refId || null,
    refItemId: row.refItemId || null,
    warehouseId: row.warehouseId || null,
    warehouseCode: row.warehouseCode || null,
    warehouseName: row.warehouseName || null,
    locationId: row.locationId || null,
    locationCode: row.locationCode || null,
    locationName: row.locationName || null,
    qtyIn: round4(row.qtyIn),
    qtyOut: round4(row.qtyOut),
    balanceAfter: round4(row.balanceAfter),
    unitCost: round4(row.unitCost),
    valueIn: round2(row.valueIn),
    valueOut: round2(row.valueOut),
    valueBalance: round2(row.valueBalance),
    currency: row.currency || null,
  };
}

async function listInventoryLedger(companyId, query = {}, options = {}) {
  ensureCompanyId(companyId);

  const productId = asText(query.productId);
  if (!productId) {
    throw validationError('productId is required', { field: 'productId' });
  }

  const { dateFrom, dateToExclusive } = normalizeDateRange(query || {});
  const filters = {
    productId,
    variantId: asText(query.variantId) || null,
    warehouseId: asText(query.warehouseId) || null,
    currency: normalizeCurrency(query.currency),
  };

  const replacements = { companyId, dateFrom, dateToExclusive };
  const where = buildWhere(filters, replacements);

  const rows = await StockMove.sequelize.query(
    `
    WITH typed_moves AS (
      SELECT
        sm.id,
        sm.created_at AS date,
        -- K1.8: PZ_KOREKTA / WZ_KOREKTA stock_moves carry the long ref_type; expose the
        -- short PZK / WZK label to ledger consumers so the route mapper on the frontend
        -- can resolve /main/wms/receipts/:id and /main/wms/shipments/:id.
        CASE
          WHEN sm.ref_type = 'PZ_KOREKTA' THEN 'PZK'
          WHEN sm.ref_type = 'WZ_KOREKTA' THEN 'WZK'
          ELSE sm.ref_type
        END AS document_type,
        sm.ref_type,
        sm.ref_id,
        sm.ref_item_id,
        sm.warehouse_id,
        sm.from_location_id,
        sm.to_location_id,
        COALESCE(sm.currency, :defaultCurrency) AS currency,
        ABS(sm.qty)::numeric AS qty,
        ABS(COALESCE(sm.total_cost, sm.qty * sm.unit_cost, 0))::numeric AS move_value,
        COALESCE(sm.unit_cost, CASE WHEN sm.qty <> 0 THEN sm.total_cost / sm.qty ELSE NULL END, 0)::numeric AS unit_cost,
        CASE
          WHEN sm.type = 'receipt' AND sm.ref_type = 'PZ' THEN 'in'
          WHEN sm.type = 'adjustment' AND sm.ref_type = 'PW' THEN 'in'
          WHEN sm.type = 'transfer' AND sm.ref_type = 'MM' AND sm.to_location_id IS NOT NULL THEN 'in'
          WHEN sm.type = 'ship' AND sm.ref_type = 'WZ' THEN 'out'
          WHEN sm.type = 'adjustment' AND sm.ref_type = 'RW' THEN 'out'
          WHEN sm.type = 'transfer' AND sm.ref_type = 'MM' AND sm.from_location_id IS NOT NULL THEN 'out'
          -- K1.8: correction reverse moves.
          -- WZ_KOREKTA = the reverse of a WZ; the reverse move is type=receipt so it
          -- credits qty_on_hand back (incoming in the ledger).
          WHEN sm.type = 'receipt' AND sm.ref_type = 'WZ_KOREKTA' THEN 'in'
          -- PZ_KOREKTA = the reverse of a PZ; the reverse move is type=ship so it
          -- debits qty_on_hand (outgoing in the ledger).
          WHEN sm.type = 'ship' AND sm.ref_type = 'PZ_KOREKTA' THEN 'out'
          ELSE NULL
        END AS direction
      FROM stock_moves sm
      WHERE ${where}
    ), ledger_rows AS (
      SELECT
        tm.*,
        CASE WHEN tm.direction = 'in' THEN tm.qty ELSE 0 END AS qty_in,
        CASE WHEN tm.direction = 'out' THEN tm.qty ELSE 0 END AS qty_out,
        CASE WHEN tm.direction = 'in' THEN tm.move_value ELSE 0 END AS value_in,
        CASE WHEN tm.direction = 'out' THEN tm.move_value ELSE 0 END AS value_out,
        CASE WHEN tm.direction = 'in' THEN tm.qty ELSE -tm.qty END AS signed_qty,
        CASE WHEN tm.direction = 'in' THEN tm.move_value ELSE -tm.move_value END AS signed_value,
        -- K1.8: PZ_KOREKTA documents live in receipts (parent_document_id != NULL), so
        -- the existing receipts join already resolves their number. Same for WZ_KOREKTA
        -- in shipments. We just widen the ref_type predicate.
        COALESCE(
          CASE WHEN tm.ref_type IN ('PZ', 'PZ_KOREKTA') THEN r.number END,
          CASE WHEN tm.ref_type IN ('WZ', 'WZ_KOREKTA') THEN sh.number END,
          CASE WHEN tm.ref_type = 'MM' THEN tr.number END,
          CASE WHEN tm.ref_type IN ('RW', 'PW') THEN adj.number END
        ) AS document_number,
        COALESCE(
          CASE WHEN tm.direction = 'in' THEN tm.to_location_id END,
          CASE WHEN tm.direction = 'out' THEN tm.from_location_id END,
          tm.to_location_id,
          tm.from_location_id
        ) AS display_location_id
      FROM typed_moves tm
      LEFT JOIN receipts r
        ON r.id = tm.ref_id
       AND r.company_id = :companyId
       AND tm.ref_type IN ('PZ', 'PZ_KOREKTA')
      LEFT JOIN shipments sh
        ON sh.id = tm.ref_id
       AND sh.company_id = :companyId
       AND tm.ref_type IN ('WZ', 'WZ_KOREKTA')
      LEFT JOIN transfer_orders tr
        ON tr.id = tm.ref_id
       AND tr.company_id = :companyId
       AND tm.ref_type = 'MM'
      LEFT JOIN adjustments adj
        ON adj.id = tm.ref_id
       AND adj.company_id = :companyId
       AND tm.ref_type IN ('RW', 'PW')
      WHERE tm.direction IS NOT NULL
    )
    SELECT
      lr.id AS "id",
      lr.date AS "date",
      lr.document_type AS "documentType",
      lr.document_number AS "documentNumber",
      lr.ref_type AS "refType",
      lr.ref_id AS "refId",
      lr.ref_item_id AS "refItemId",
      lr.warehouse_id AS "warehouseId",
      w.code AS "warehouseCode",
      w.name AS "warehouseName",
      lr.display_location_id AS "locationId",
      loc.code AS "locationCode",
      NULL::text AS "locationName",
      lr.qty_in AS "qtyIn",
      lr.qty_out AS "qtyOut",
      SUM(lr.signed_qty) OVER (ORDER BY lr.date ASC, lr.id ASC)::numeric AS "balanceAfter",
      lr.unit_cost AS "unitCost",
      lr.value_in AS "valueIn",
      lr.value_out AS "valueOut",
      SUM(lr.signed_value) OVER (ORDER BY lr.date ASC, lr.id ASC)::numeric AS "valueBalance",
      lr.currency AS "currency"
    FROM ledger_rows lr
    LEFT JOIN warehouses w
      ON w.id = lr.warehouse_id
     AND w.company_id = :companyId
    LEFT JOIN locations loc
      ON loc.id = lr.display_location_id
     AND loc.company_id = :companyId
    ORDER BY lr.date ASC, lr.id ASC
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

  const items = rows.map(mapRow);
  const currencySet = new Set(items.map((row) => row.currency).filter(Boolean));
  const lastRow = items[items.length - 1] || null;
  const totals = {
    qtyIn: round4(items.reduce((sum, row) => sum + Number(row.qtyIn || 0), 0)),
    qtyOut: round4(items.reduce((sum, row) => sum + Number(row.qtyOut || 0), 0)),
    valueIn: round2(items.reduce((sum, row) => sum + Number(row.valueIn || 0), 0)),
    valueOut: round2(items.reduce((sum, row) => sum + Number(row.valueOut || 0), 0)),
    balanceAfter: lastRow ? round4(lastRow.balanceAfter) : 0,
    valueBalance: lastRow ? round2(lastRow.valueBalance) : 0,
    currency: filters.currency || (currencySet.size === 1 ? [...currencySet][0] : (currencySet.size > 1 ? 'MIXED' : null)),
  };

  return { items, total: items.length, totals };
}

module.exports = {
  listInventoryLedger,
};
