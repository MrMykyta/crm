'use strict';

// Unified warehouse documents list (WMS-DOCS-2).
//
// One query that unions receipts/shipments/transfer_orders/adjustments into a normalised
// row shape and applies filters/pagination at the outer level. Per-row items_count + total_qty
// come from correlated sub-selects; warehouse codes from LEFT JOINs.
//
// Corrections (PZK/WZK) are receipts/shipments rows with parent_document_id set. They are
// exposed in this unified list with the same detail routes as their base document families.

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../models');
const AppError = require('../../errors/AppError');

const SUPPORTED_TYPES = ['PZ', 'WZ', 'MM', 'RW', 'PW', 'PZK', 'WZK'];
const FUTURE_TYPES = ['PZ_KOREKTA', 'WZ_KOREKTA'];
const ALLOWED_TYPES = new Set([...SUPPORTED_TYPES, ...FUTURE_TYPES]);

const ROUTE_BY_TYPE = {
  PZ: 'receipts',
  PZK: 'receipts',
  WZ: 'shipments',
  WZK: 'shipments',
  MM: 'transfers',
  RW: 'adjustments',
  PW: 'adjustments',
};

function ensureCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
}

function parseList(value, transform = (v) => v) {
  if (value === null || value === undefined || value === '') return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(arr.map((v) => transform(String(v).trim())).filter(Boolean))];
}

function parseTypes(value) {
  const list = parseList(value, (s) => s.toUpperCase());
  const invalid = list.filter((t) => !ALLOWED_TYPES.has(t));
  if (invalid.length) {
    throw new AppError(400, `Unsupported document type(s): ${invalid.join(', ')}`, {
      code: 'VALIDATION_ERROR',
      details: { allowed: SUPPORTED_TYPES, future: FUTURE_TYPES },
    });
  }
  return list;
}

function parseStatuses(value) {
  return parseList(value, (s) => s.toLowerCase());
}

function parseDate(value, fieldName) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) {
    throw new AppError(400, `${fieldName} is invalid`, { code: 'VALIDATION_ERROR' });
  }
  return d;
}

function parsePaging(query = {}) {
  const limitRaw = Number.parseInt(query.limit ?? query.pageSize ?? 50, 10);
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));

  let offset = 0;
  let page = 1;
  if (query.offset !== undefined && query.offset !== null && query.offset !== '') {
    const o = Number.parseInt(query.offset, 10);
    offset = Number.isFinite(o) && o >= 0 ? o : 0;
    page = Math.floor(offset / limit) + 1;
  } else if (query.page !== undefined && query.page !== null && query.page !== '') {
    page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    offset = (page - 1) * limit;
  }
  return { limit, offset, page };
}

// Builds the unified SELECT. Array filters (type IN (...), status IN (...)) are added
// conditionally so empty replacement arrays don't produce `IN ()` syntax errors —
// Sequelize substitutes named replacements as literals into the SQL string.
function buildUnifiedSql({ types, statuses, search, dateFrom, dateTo }) {
  const outerConditions = [];
  if (types.length) outerConditions.push('u.type IN (:types)');
  if (statuses.length) outerConditions.push('u.status IN (:statuses)');
  if (search) outerConditions.push('u.number ILIKE :search');
  if (dateFrom) outerConditions.push('u.date >= CAST(:dateFrom AS timestamptz)');
  if (dateTo) outerConditions.push('u.date <= CAST(:dateTo AS timestamptz)');
  const whereClause = outerConditions.length
    ? `WHERE ${outerConditions.join('\n  AND ')}`
    : '';

  return `
WITH unified AS (
  SELECT
    r.id::uuid                                AS id,
    CASE WHEN r.parent_document_id IS NULL THEN 'PZ' ELSE 'PZK' END::text AS type,
    r.number                                  AS number,
    r.status::text                            AS status,
    r.created_at                              AS date,
    r.warehouse_id                            AS warehouse_id,
    NULL::uuid                                AS source_warehouse_id,
    NULL::uuid                                AS target_warehouse_id,
    r.created_at                              AS created_at,
    r.company_id                              AS company_id,
    r.parent_document_id                      AS parent_document_id,
    r.corrected_by_id                         AS corrected_by_id,
    CASE
      WHEN r.parent_document_id IS NOT NULL THEN 'correction'
      WHEN r.corrected_by_id IS NOT NULL THEN 'original'
      ELSE NULL
    END::text                                 AS document_relation,
    (SELECT COUNT(*) FROM receipt_items ri WHERE ri.receipt_id = r.id)::bigint AS items_count,
    (SELECT COALESCE(SUM(ri.qty_expected), 0) FROM receipt_items ri WHERE ri.receipt_id = r.id)::numeric AS total_qty
  FROM receipts r
  WHERE r.company_id = :companyId
    AND (CAST(:warehouseId AS uuid) IS NULL OR r.warehouse_id = CAST(:warehouseId AS uuid))

  UNION ALL

  SELECT
    s.id,
    CASE WHEN s.parent_document_id IS NULL THEN 'WZ' ELSE 'WZK' END::text,
    s.number, s.status::text, s.created_at, s.warehouse_id,
    NULL::uuid, NULL::uuid, s.created_at, s.company_id,
    s.parent_document_id,
    s.corrected_by_id,
    CASE
      WHEN s.parent_document_id IS NOT NULL THEN 'correction'
      WHEN s.corrected_by_id IS NOT NULL THEN 'original'
      ELSE NULL
    END::text,
    (SELECT COUNT(*) FROM shipment_items si WHERE si.shipment_id = s.id)::bigint,
    (SELECT COALESCE(SUM(si.qty), 0) FROM shipment_items si WHERE si.shipment_id = s.id)::numeric
  FROM shipments s
  WHERE s.company_id = :companyId
    AND (CAST(:warehouseId AS uuid) IS NULL OR s.warehouse_id = CAST(:warehouseId AS uuid))

  UNION ALL

  SELECT
    t.id, 'MM'::text, t.number, t.status::text, t.created_at,
    NULL::uuid, t.from_warehouse_id, t.to_warehouse_id, t.created_at, t.company_id,
    NULL::uuid, NULL::uuid, NULL::text,
    (SELECT COUNT(*) FROM transfer_items ti WHERE ti.transfer_id = t.id)::bigint,
    (SELECT COALESCE(SUM(ti.qty), 0) FROM transfer_items ti WHERE ti.transfer_id = t.id)::numeric
  FROM transfer_orders t
  WHERE t.company_id = :companyId
    AND (CAST(:warehouseId AS uuid) IS NULL
         OR t.from_warehouse_id = CAST(:warehouseId AS uuid)
         OR t.to_warehouse_id = CAST(:warehouseId AS uuid))

  UNION ALL

  SELECT
    a.id, a.document_type::text, a.number, a.status::text,
    COALESCE(a.posted_at, a.created_at), a.warehouse_id,
    NULL::uuid, NULL::uuid, a.created_at, a.company_id,
    NULL::uuid, NULL::uuid, NULL::text,
    (SELECT COUNT(*) FROM adjustment_items ai WHERE ai.adjustment_id = a.id)::bigint,
    (SELECT COALESCE(SUM(ABS(ai.qty_delta)), 0) FROM adjustment_items ai WHERE ai.adjustment_id = a.id)::numeric
  FROM adjustments a
  WHERE a.company_id = :companyId
    AND (CAST(:warehouseId AS uuid) IS NULL OR a.warehouse_id = CAST(:warehouseId AS uuid))
)
SELECT
  u.id,
  u.type,
  u.number,
  u.status,
  u.date,
  u.warehouse_id              AS "warehouseId",
  wh.code                     AS "warehouseCode",
  u.source_warehouse_id       AS "sourceWarehouseId",
  ws.code                     AS "sourceWarehouseCode",
  u.target_warehouse_id       AS "targetWarehouseId",
  wt.code                     AS "targetWarehouseCode",
  u.parent_document_id        AS "parentDocumentId",
  u.corrected_by_id           AS "correctedById",
  u.document_relation         AS "documentRelation",
  u.created_at                AS "createdAt",
  u.items_count               AS "itemsCount",
  u.total_qty                 AS "totalQty",
  COUNT(*) OVER ()            AS "totalCount"
FROM unified u
LEFT JOIN warehouses wh ON wh.id = u.warehouse_id
LEFT JOIN warehouses ws ON ws.id = u.source_warehouse_id
LEFT JOIN warehouses wt ON wt.id = u.target_warehouse_id
${whereClause}
ORDER BY u.date DESC NULLS LAST, u.created_at DESC, u.id
LIMIT :limit OFFSET :offset
`;
}

function buildRoute(row) {
  const segment = ROUTE_BY_TYPE[row.type] || null;
  if (!segment || !row.id) return null;
  return `/main/wms/${segment}/${row.id}`;
}

function normaliseRow(row) {
  return {
    id: row.id,
    type: row.type,
    number: row.number || null,
    status: row.status || null,
    date: row.date ? new Date(row.date).toISOString() : null,
    warehouseId: row.warehouseId || null,
    warehouseCode: row.warehouseCode || null,
    sourceWarehouseId: row.sourceWarehouseId || null,
    sourceWarehouseCode: row.sourceWarehouseCode || null,
    targetWarehouseId: row.targetWarehouseId || null,
    targetWarehouseCode: row.targetWarehouseCode || null,
    parentDocumentId: row.parentDocumentId || null,
    correctedById: row.correctedById || null,
    documentRelation: row.documentRelation || null,
    itemsCount: Number(row.itemsCount) || 0,
    totalQty: row.totalQty !== null && row.totalQty !== undefined ? Number(row.totalQty) : 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    route: buildRoute(row),
  };
}

// list: unified warehouse documents list.
async function list({ companyId, query = {}, options = {} } = {}) {
  ensureCompanyId(companyId);

  const types = parseTypes(query.type);
  const statuses = parseStatuses(query.status);
  const search = String(query.search || query.q || '').trim();
  const warehouseId = String(query.warehouseId || '').trim() || null;
  const dateFrom = parseDate(query.dateFrom, 'dateFrom');
  const dateTo = parseDate(query.dateTo, 'dateTo');
  const { limit, offset, page } = parsePaging(query);

  const replacements = {
    companyId,
    warehouseId,
    limit,
    offset,
  };
  if (types.length) replacements.types = types;
  if (statuses.length) replacements.statuses = statuses;
  if (search) replacements.search = `%${search}%`;
  if (dateFrom) replacements.dateFrom = dateFrom;
  if (dateTo) replacements.dateTo = dateTo;

  const sql = buildUnifiedSql({ types, statuses, search, dateFrom, dateTo });

  const rows = await sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction: options.transaction || null,
  });

  const total = rows.length > 0 ? Number(rows[0].totalCount) || 0 : 0;
  const data = rows.map(normaliseRow);
  const pageCount = Math.max(1, Math.ceil(total / limit));

  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      page,
      pageSize: limit,
      pageCount,
    },
  };
}

module.exports = {
  list,
  SUPPORTED_TYPES,
  FUTURE_TYPES,
  ALLOWED_TYPES,
  ROUTE_BY_TYPE,
  // Exposed for tests / smoke.
  _internal: { parseTypes, parseStatuses, parsePaging, buildRoute, normaliseRow, buildUnifiedSql },
};
