'use strict';

// costingOpeningBalanceService — G1.2c hybrid (A+B).
//
// Walks current inventory_items (qty_on_hand > 0) that are not covered by any cost_layers row
// and synthesizes OPENING layers from Product/Variant catalog cost. Flips the per-company
// company_warehouse_document_settings.costing_initialized_at flag, which is the gate
// costingService.assertCostingInitialized checks on every outgoing FIFO consumption.

const { Op, QueryTypes } = require('sequelize');
const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const {
  CompanyWarehouseDocumentSetting,
  CostLayer,
  InventoryItem,
  Product,
  ProductVariant,
  StockMoveCostAllocation,
} = require('../../models');

const OPENING_REF_TYPE = 'OPENING';
const EPOCH_FALLBACK = new Date('1970-01-01T00:00:00Z');

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeCurrency(value) {
  const c = String(value || '').trim().toUpperCase();
  return c || 'PLN';
}

function ensureCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
}

// Loads (or lazily creates) the per-company settings row, optionally under FOR UPDATE.
async function loadSettingsRow(companyId, { transaction = null, lock = false } = {}) {
  let row = await CompanyWarehouseDocumentSetting.findOne({
    where: { companyId },
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!row) {
    row = await CompanyWarehouseDocumentSetting.create(
      { companyId },
      { transaction }
    );
    if (lock && transaction) {
      row = await CompanyWarehouseDocumentSetting.findOne({
        where: { companyId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }
  }
  return row;
}

// Groups uncovered (qty_on_hand > 0 without a covering cost_layer) by the costing key.
// Coverage is keyed by (company, warehouse, location, product, variant) — NULL-safe via
// `IS NOT DISTINCT FROM`. Lot/serial are intentionally excluded: costing granularity in
// MVP is coarser than inventory granularity.
async function findUncoveredInventoryItems(companyId, { transaction = null } = {}) {
  ensureCompanyId(companyId);
  const rows = await CompanyWarehouseDocumentSetting.sequelize.query(
    `
    SELECT
      ii.warehouse_id   AS "warehouseId",
      ii.location_id    AS "locationId",
      ii.product_id     AS "productId",
      ii.variant_id     AS "variantId",
      SUM(ii.qty_on_hand) AS "qtyOnHandTotal",
      MIN(ii.created_at)  AS "earliestCreatedAt"
    FROM inventory_items ii
    WHERE ii.company_id = :companyId
      AND ii.qty_on_hand > 0
      AND NOT EXISTS (
        SELECT 1 FROM cost_layers cl
        WHERE cl.company_id = ii.company_id
          AND cl.warehouse_id = ii.warehouse_id
          AND cl.product_id = ii.product_id
          AND cl.variant_id IS NOT DISTINCT FROM ii.variant_id
          AND cl.location_id IS NOT DISTINCT FROM ii.location_id
      )
    GROUP BY ii.warehouse_id, ii.location_id, ii.product_id, ii.variant_id
    ORDER BY MIN(ii.created_at) ASC, ii.warehouse_id, ii.location_id, ii.product_id
    `,
    {
      replacements: { companyId },
      transaction,
      type: QueryTypes.SELECT,
    }
  );

  return rows.map((row) => ({
    warehouseId: row.warehouseId,
    locationId: row.locationId,
    productId: row.productId,
    variantId: row.variantId,
    qtyOnHandTotal: Number(row.qtyOnHandTotal),
    earliestCreatedAt: row.earliestCreatedAt ? new Date(row.earliestCreatedAt) : null,
  }));
}

// Quick per-company status for UI / CLI / smoke.
async function getInitializationStatus(companyId, { transaction = null } = {}) {
  ensureCompanyId(companyId);
  const row = await CompanyWarehouseDocumentSetting.findOne({
    where: { companyId },
    transaction,
  });
  const [totalRow, gapRow] = await Promise.all([
    InventoryItem.count({
      where: { companyId, qtyOnHand: { [Op.gt]: 0 } },
      transaction,
    }),
    InventoryItem.sequelize.query(
      `
      SELECT COUNT(*)::int AS "gapCount"
      FROM inventory_items ii
      WHERE ii.company_id = :companyId
        AND ii.qty_on_hand > 0
        AND NOT EXISTS (
          SELECT 1 FROM cost_layers cl
          WHERE cl.company_id = ii.company_id
            AND cl.warehouse_id = ii.warehouse_id
            AND cl.product_id = ii.product_id
            AND cl.variant_id IS NOT DISTINCT FROM ii.variant_id
            AND cl.location_id IS NOT DISTINCT FROM ii.location_id
        )
      `,
      {
        replacements: { companyId },
        transaction,
        type: QueryTypes.SELECT,
      }
    ),
  ]);

  const totalItems = Number(totalRow) || 0;
  const gapItems = (gapRow[0] && Number(gapRow[0].gapCount)) || 0;

  return {
    initialized: Boolean(row?.costingInitializedAt),
    initializedAt: row?.costingInitializedAt || null,
    inventoryCostMethod: row?.inventoryCostMethod || 'FIFO',
    totalItems,
    gapItems,
    coveredItems: Math.max(totalItems - gapItems, 0),
  };
}

// Loads product/variant catalog cost+currency for the (productId, variantId) pairs at hand.
async function loadCostCatalog(uncovered, transaction) {
  const productIds = [...new Set(uncovered.map((g) => g.productId).filter(Boolean))];
  const variantIds = [...new Set(uncovered.map((g) => g.variantId).filter(Boolean))];

  const [products, variants] = await Promise.all([
    productIds.length
      ? Product.findAll({
        where: { id: { [Op.in]: productIds } },
        attributes: ['id', 'cost', 'currency'],
        transaction,
      })
      : Promise.resolve([]),
    variantIds.length
      ? ProductVariant.findAll({
        where: { id: { [Op.in]: variantIds } },
        attributes: ['id', 'cost', 'currency'],
        transaction,
      })
      : Promise.resolve([]),
  ]);

  return {
    productMap: new Map(products.map((p) => [p.id, { cost: toNumberOrNull(p.cost), currency: p.currency || null }])),
    variantMap: new Map(variants.map((v) => [v.id, { cost: toNumberOrNull(v.cost), currency: v.currency || null }])),
  };
}

// Resolves unit cost + currency for one group using the variant → product → fallback chain.
// Returns null `unitCost` to flag the row for OPENING_COST_MISSING (caller decides what to do).
function resolveGroupCost(group, { productMap, variantMap, unitCostFallback }) {
  const variant = group.variantId ? variantMap.get(group.variantId) : null;
  const product = productMap.get(group.productId) || null;

  let unitCost = variant && variant.cost !== null ? variant.cost : null;
  if (unitCost === null) unitCost = product && product.cost !== null ? product.cost : null;
  if (unitCost === null) unitCost = toNumberOrNull(unitCostFallback);

  const currency = normalizeCurrency(
    (variant && variant.currency) || (product && product.currency) || 'PLN'
  );

  return { unitCost: unitCost === null ? null : round4(unitCost), currency };
}

function buildLayerPlan(group, resolved) {
  const qty = round4(group.qtyOnHandTotal);
  const unitCost = resolved.unitCost;
  return {
    warehouseId: group.warehouseId,
    locationId: group.locationId,
    productId: group.productId,
    variantId: group.variantId,
    qtyIn: qty,
    qtyRemaining: qty,
    unitCost,
    totalCost: unitCost === null ? null : round4(qty * unitCost),
    currency: resolved.currency,
    receivedAt: group.earliestCreatedAt || EPOCH_FALLBACK,
  };
}

// Counts allocations referencing any existing OPENING layer for the company.
async function countOpeningAllocations(companyId, transaction) {
  const [rows] = await CostLayer.sequelize.query(
    `
    SELECT COUNT(*)::int AS "allocations"
    FROM stock_move_cost_allocations a
    JOIN cost_layers cl ON cl.id = a.cost_layer_id
    WHERE cl.company_id = :companyId
      AND cl.source_ref_type = :openingRef
      AND cl.source_move_id IS NULL
    `,
    {
      replacements: { companyId, openingRef: OPENING_REF_TYPE },
      transaction,
      type: QueryTypes.SELECT,
    }
  );
  return Number(rows?.allocations) || 0;
}

async function deleteExistingOpeningLayers(companyId, transaction) {
  return CostLayer.destroy({
    where: {
      companyId,
      sourceRefType: OPENING_REF_TYPE,
      sourceMoveId: null,
    },
    transaction,
  });
}

// initializeForCompany — see WMS_OPENING_BALANCE_PLAN.md §6.
async function initializeForCompany(
  companyId,
  { dryRun = false, unitCostFallback = null, force = false } = {},
  { transaction = null } = {}
) {
  ensureCompanyId(companyId);

  return withTx(async (t) => {
    const settings = await loadSettingsRow(companyId, { transaction: t, lock: true });

    if (settings.costingInitializedAt && !force) {
      throw new AppError(409, 'COSTING_ALREADY_INITIALIZED', {
        code: 'COSTING_ALREADY_INITIALIZED',
        details: { companyId, initializedAt: settings.costingInitializedAt },
      });
    }

    if (settings.costingInitializedAt && force) {
      const allocCount = await countOpeningAllocations(companyId, t);
      if (allocCount > 0) {
        throw new AppError(409, 'OPENING_LAYERS_ALREADY_CONSUMED', {
          code: 'OPENING_LAYERS_ALREADY_CONSUMED',
          details: { companyId, allocationCount: allocCount },
        });
      }
      if (!dryRun) {
        await deleteExistingOpeningLayers(companyId, t);
      }
    }

    const uncovered = await findUncoveredInventoryItems(companyId, { transaction: t });
    const { productMap, variantMap } = await loadCostCatalog(uncovered, t);

    const plans = [];
    const missingCosts = [];
    for (const group of uncovered) {
      const resolved = resolveGroupCost(group, { productMap, variantMap, unitCostFallback });
      const plan = buildLayerPlan(group, resolved);
      if (resolved.unitCost === null) {
        missingCosts.push({
          productId: group.productId,
          variantId: group.variantId,
          warehouseId: group.warehouseId,
          locationId: group.locationId,
          qtyOnHand: plan.qtyIn,
        });
      }
      plans.push(plan);
    }

    if (missingCosts.length > 0) {
      throw new AppError(409, 'OPENING_COST_MISSING', {
        code: 'OPENING_COST_MISSING',
        details: { companyId, missingCount: missingCosts.length, missingCosts },
      });
    }

    const totalQty = round4(plans.reduce((s, p) => s + p.qtyIn, 0));
    const totalValue = round4(plans.reduce((s, p) => s + (p.totalCost || 0), 0));

    if (dryRun) {
      return {
        dryRun: true,
        initializedAt: settings.costingInitializedAt || null,
        forced: Boolean(force),
        itemsCount: plans.length,
        totalQty,
        totalValue,
        missingCosts: [],
        layersToCreate: plans,
      };
    }

    const createdLayers = [];
    for (const plan of plans) {
      const layer = await CostLayer.create(
        {
          companyId,
          warehouseId: plan.warehouseId,
          locationId: plan.locationId,
          productId: plan.productId,
          variantId: plan.variantId,
          sourceMoveId: null,
          sourceAllocationId: null,
          sourceRefType: OPENING_REF_TYPE,
          sourceRefId: null,
          sourceRefItemId: null,
          qtyIn: plan.qtyIn,
          qtyRemaining: plan.qtyRemaining,
          unitCost: plan.unitCost,
          totalCost: plan.totalCost,
          currency: plan.currency,
          receivedAt: plan.receivedAt,
        },
        { transaction: t }
      );
      createdLayers.push(layer);
    }

    const initializedAt = new Date();
    await settings.update({ costingInitializedAt: initializedAt }, { transaction: t });

    return {
      dryRun: false,
      initializedAt,
      forced: Boolean(force),
      itemsCount: createdLayers.length,
      totalQty,
      totalValue,
      missingCosts: [],
      layers: createdLayers,
    };
  }, transaction);
}

module.exports = {
  OPENING_REF_TYPE,
  getInitializationStatus,
  findUncoveredInventoryItems,
  initializeForCompany,
  // Exposed for tests/diagnostics; not part of the main API.
  _internal: {
    resolveGroupCost,
    buildLayerPlan,
    countOpeningAllocations,
    deleteExistingOpeningLayers,
    loadSettingsRow,
  },
};
