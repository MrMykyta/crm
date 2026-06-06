'use strict';

// Standalone integration smoke for FIFO costing wired into real WMS flows (G1.3).
// NON-DESTRUCTIVE: everything runs inside a single transaction and is ALWAYS rolled back.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeCostingWmsFlows.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  CostLayer,
  InventoryItem,
  Location,
  Product,
  StockMove,
  StockMoveCostAllocation,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const adjustmentService = require('../src/services/wms/adjustmentService');
const transferService = require('../src/services/wms/transferService');
const openingBalanceService = require('../src/services/wms/costingOpeningBalanceService');

const results = [];

function check(name, cond, extra = '') {
  const ok = Boolean(cond);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

function n(v) {
  return Number(v);
}

async function expectAppError(name, expectedCode, fn) {
  try {
    await fn();
    check(name, false, 'no error thrown');
  } catch (error) {
    check(
      name,
      error instanceof AppError && error.statusCode === 409 && error.code === expectedCode,
      `status=${error.statusCode} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

// Runs fn inside a Sequelize SAVEPOINT child of the outer transaction. If fn throws,
// the savepoint is rolled back and the outer transaction stays clean. Mirrors how the
// real API layer wraps each service call in its own transaction.
async function expectAppErrorIsolated(name, expectedCode, outerT, fn) {
  try {
    await sequelize.transaction({ transaction: outerT }, async (sp) => {
      await fn(sp);
    });
    check(name, false, 'no error thrown');
  } catch (error) {
    check(
      name,
      error instanceof AppError && error.statusCode === 409 && error.code === expectedCode,
      `status=${error.statusCode} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

async function sumCompanyStockValue(companyId, productId, transaction) {
  const layers = await CostLayer.findAll({
    where: { companyId, productId },
    transaction,
  });
  return layers.reduce((s, l) => s + n(l.qtyRemaining) * n(l.unitCost), 0);
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();

    // ============================================================
    // Setup: company A (initialized), warehouse, 2 locations, product with Product.cost
    // ============================================================
    const companyA = await Company.create({ name: `Costing Flows Smoke A ${suffix}` }, { transaction: t });
    const companyAId = companyA.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId: companyAId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );
    const whA = await Warehouse.create(
      { id: crypto.randomUUID(), companyId: companyAId, code: 'CF-WH', name: 'Costing Flows WH', isActive: true },
      { transaction: t }
    );
    const locA = await Location.create(
      { id: crypto.randomUUID(), companyId: companyAId, warehouseId: whA.id, code: 'LOC-A', type: 'bulk' },
      { transaction: t }
    );
    const locB = await Location.create(
      { id: crypto.randomUUID(), companyId: companyAId, warehouseId: whA.id, code: 'LOC-B', type: 'bulk' },
      { transaction: t }
    );
    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId: companyAId,
        name: 'Costing Flows Product',
        slug: `costing-flows-${suffix}`,
        sku: 'CF-1',
        cost: 20,
      },
      { transaction: t }
    );

    // ============================================================
    // Scenario 1: PZ 10×20 → cost layer 10×20
    // ============================================================
    const pz = await receiptService.create(
      companyAId,
      {
        warehouseId: whA.id,
        items: [{ productId: product.id, qtyExpected: 10, unitCost: 20, currency: 'PLN' }],
      },
      t
    );
    await receiptService.receiveLine(companyAId, pz.items[0].id, { qty: 10, toLocationId: locA.id }, t);
    const pzMove = await StockMove.findOne({
      where: { companyId: companyAId, refType: 'PZ', refId: pz.id, type: 'receipt' },
      transaction: t,
    });
    check('PZ receive → stockMove unitCost=20, totalCost=200, costMethod=FIFO',
      pzMove && n(pzMove.unitCost) === 20 && n(pzMove.totalCost) === 200 && pzMove.costMethod === 'FIFO',
      `unit=${pzMove && pzMove.unitCost} total=${pzMove && pzMove.totalCost} m=${pzMove && pzMove.costMethod}`);
    const pzLayer = await CostLayer.findOne({
      where: { companyId: companyAId, sourceMoveId: pzMove.id },
      transaction: t,
    });
    check('PZ receive → cost layer 10×20, qtyRemaining=10',
      pzLayer && n(pzLayer.qtyIn) === 10 && n(pzLayer.qtyRemaining) === 10
        && n(pzLayer.unitCost) === 20 && n(pzLayer.totalCost) === 200,
      `qtyIn=${pzLayer && pzLayer.qtyIn} unit=${pzLayer && pzLayer.unitCost}`);

    // ============================================================
    // Scenario 2: WZ 3 → totalCost=60, layer.qtyRemaining=7
    // ============================================================
    const wz = await shipmentService.create(
      companyAId,
      { warehouseId: whA.id, items: [{ productId: product.id, qty: 3 }] },
      t
    );
    await shipmentService.shipItem(
      companyAId,
      wz.items[0].id,
      { qty: 3, fromLocationId: locA.id },
      t
    );
    const wzMove = await StockMove.findOne({
      where: { companyId: companyAId, refType: 'WZ', refId: wz.id, type: 'ship' },
      transaction: t,
    });
    check('WZ ship 3 → stockMove totalCost=60, unitCost=20',
      wzMove && n(wzMove.totalCost) === 60 && n(wzMove.unitCost) === 20,
      `total=${wzMove && wzMove.totalCost} unit=${wzMove && wzMove.unitCost}`);
    const pzLayerAfterShip = await CostLayer.findByPk(pzLayer.id, { transaction: t });
    check('WZ ship 3 → PZ layer qtyRemaining=7', n(pzLayerAfterShip.qtyRemaining) === 7,
      `remaining=${pzLayerAfterShip.qtyRemaining}`);
    const wzAllocCount = await StockMoveCostAllocation.count({
      where: { stockMoveId: wzMove.id }, transaction: t,
    });
    check('WZ ship 3 → 1 cost allocation row', wzAllocCount === 1, `allocs=${wzAllocCount}`);

    // ============================================================
    // Scenario 3: PW 5×15 → second cost layer
    // ============================================================
    const pwDoc = await adjustmentService.create(
      companyAId,
      {
        warehouseId: whA.id,
        documentType: 'PW',
        reason: 'smoke PW',
        items: [{ productId: product.id, locationId: locA.id, qtyDelta: 5, unitCost: 15 }],
      },
      t
    );
    await adjustmentService.post(companyAId, pwDoc.id, t);
    const pwMove = await StockMove.findOne({
      where: { companyId: companyAId, refType: 'PW', refId: pwDoc.id, type: 'adjustment' },
      transaction: t,
    });
    check('PW post → stockMove unitCost=15, totalCost=75',
      pwMove && n(pwMove.unitCost) === 15 && n(pwMove.totalCost) === 75,
      `unit=${pwMove && pwMove.unitCost} total=${pwMove && pwMove.totalCost}`);
    const pwLayer = await CostLayer.findOne({
      where: { companyId: companyAId, sourceMoveId: pwMove.id },
      transaction: t,
    });
    check('PW post → second cost layer 5×15',
      pwLayer && n(pwLayer.qtyIn) === 5 && n(pwLayer.qtyRemaining) === 5 && n(pwLayer.unitCost) === 15,
      `qty=${pwLayer && pwLayer.qtyIn} unit=${pwLayer && pwLayer.unitCost}`);

    // ============================================================
    // Scenario 4: RW 2 → consumes FIFO from oldest layer (PZ layer @20)
    // ============================================================
    const rwDoc = await adjustmentService.create(
      companyAId,
      {
        warehouseId: whA.id,
        documentType: 'RW',
        reason: 'smoke RW',
        items: [{ productId: product.id, locationId: locA.id, qtyDelta: -2 }],
      },
      t
    );
    await adjustmentService.post(companyAId, rwDoc.id, t);
    const rwMove = await StockMove.findOne({
      where: { companyId: companyAId, refType: 'RW', refId: rwDoc.id, type: 'adjustment' },
      transaction: t,
    });
    check('RW post → stockMove totalCost=40 (2 × 20 FIFO), unitCost=20',
      rwMove && n(rwMove.totalCost) === 40 && n(rwMove.unitCost) === 20,
      `total=${rwMove && rwMove.totalCost} unit=${rwMove && rwMove.unitCost}`);
    const pzLayerAfterRw = await CostLayer.findByPk(pzLayer.id, { transaction: t });
    check('RW post → PZ layer qtyRemaining=5 (was 7)', n(pzLayerAfterRw.qtyRemaining) === 5,
      `remaining=${pzLayerAfterRw.qtyRemaining}`);

    // ============================================================
    // Scenario 5: MM 4 from locA → locB
    //   source layers: (5 @ 20 remaining) + (5 @ 15 remaining); MM takes 4 from oldest (@20)
    //   target: 1 cost layer at locB (4 @ 20) preserving source unit_cost
    //   company total value unchanged
    // ============================================================
    const preMmValue = await sumCompanyStockValue(companyAId, product.id, t);
    // pre: layer @20 has 5 remaining + layer @15 has 5 remaining → 5×20 + 5×15 = 175
    check('pre-MM company value = 175 (5×20 + 5×15)',
      Math.round(preMmValue * 100) === 17500, `pre=${preMmValue}`);

    const mm = await transferService.create(
      companyAId,
      {
        fromWarehouseId: whA.id,
        toWarehouseId: whA.id,
        items: [{ productId: product.id, qty: 4 }],
      },
      t
    );
    const mmItems = await sequelize.query(
      'SELECT id FROM transfer_items WHERE transfer_id = :tid',
      { replacements: { tid: mm.id }, transaction: t, type: sequelize.QueryTypes.SELECT }
    );
    const mmItemId = mmItems[0].id;
    await transferService.executeLine(
      companyAId,
      mmItemId,
      { fromLocationId: locA.id, toLocationId: locB.id, qty: 4 },
      t
    );

    const mmOutMove = await StockMove.findOne({
      where: { companyId: companyAId, refType: 'MM', refId: mm.id, refItemId: mmItemId, fromLocationId: locA.id },
      transaction: t,
    });
    const mmInMove = await StockMove.findOne({
      where: { companyId: companyAId, refType: 'MM', refId: mm.id, refItemId: mmItemId, toLocationId: locB.id },
      transaction: t,
    });
    check('MM outMove and inMove both exist', Boolean(mmOutMove && mmInMove));
    check('MM outMove totalCost=80 (4×20), unitCost=20',
      n(mmOutMove.totalCost) === 80 && n(mmOutMove.unitCost) === 20,
      `out total=${mmOutMove.totalCost}`);
    check('MM inMove totalCost=80, unitCost=20',
      n(mmInMove.totalCost) === 80 && n(mmInMove.unitCost) === 20);

    const mmOutAllocs = await StockMoveCostAllocation.findAll({
      where: { stockMoveId: mmOutMove.id }, transaction: t,
    });
    check('MM outMove has 1 allocation (single source layer @20)',
      mmOutAllocs.length === 1, `allocs=${mmOutAllocs.length}`);

    const mmTargetLayers = await CostLayer.findAll({
      where: { sourceMoveId: mmInMove.id }, transaction: t,
    });
    check('MM inMove creates 1 target layer at locB preserving unit_cost=20',
      mmTargetLayers.length === 1
        && n(mmTargetLayers[0].qtyRemaining) === 4
        && n(mmTargetLayers[0].unitCost) === 20
        && mmTargetLayers[0].locationId === locB.id,
      `count=${mmTargetLayers.length} unit=${mmTargetLayers[0] && mmTargetLayers[0].unitCost}`);
    check('MM target layer sourceAllocationId matches the consumed allocation',
      mmTargetLayers[0].sourceAllocationId === mmOutAllocs[0].id);

    const pzLayerAfterMm = await CostLayer.findByPk(pzLayer.id, { transaction: t });
    check('MM source PZ layer qtyRemaining 5 → 1', n(pzLayerAfterMm.qtyRemaining) === 1,
      `remaining=${pzLayerAfterMm.qtyRemaining}`);

    const postMmValue = await sumCompanyStockValue(companyAId, product.id, t);
    // post: PZ layer 1@20 + PW layer 5@15 + MM target 4@20 = 20 + 75 + 80 = 175
    check('post-MM company value unchanged = 175',
      Math.round(postMmValue * 100) === 17500, `post=${postMmValue}`);

    // ============================================================
    // Scenario 8 (idempotency): repeated post/ship/execute do NOT duplicate layers/allocations
    // ============================================================
    const layersBeforeRepeat = await CostLayer.count({ where: { companyId: companyAId }, transaction: t });
    const allocsBeforeRepeat = await StockMoveCostAllocation.count({
      where: { companyId: companyAId }, transaction: t,
    });
    // Repeats — all should be document-level no-ops:
    await receiptService.receiveLine(companyAId, pz.items[0].id, { qty: 10, toLocationId: locA.id }, t).catch(() => null);
    await shipmentService.shipItem(companyAId, wz.items[0].id, { qty: 3, fromLocationId: locA.id }, t).catch(() => null);
    await adjustmentService.post(companyAId, pwDoc.id, t);
    await adjustmentService.post(companyAId, rwDoc.id, t);
    await transferService.executeLine(
      companyAId, mmItemId,
      { fromLocationId: locA.id, toLocationId: locB.id, qty: 4 }, t
    ).catch(() => null);

    const layersAfterRepeat = await CostLayer.count({ where: { companyId: companyAId }, transaction: t });
    const allocsAfterRepeat = await StockMoveCostAllocation.count({
      where: { companyId: companyAId }, transaction: t,
    });
    check('idempotency: cost_layers count unchanged across repeated ops',
      layersAfterRepeat === layersBeforeRepeat,
      `before=${layersBeforeRepeat} after=${layersAfterRepeat}`);
    check('idempotency: allocations count unchanged across repeated ops',
      allocsAfterRepeat === allocsBeforeRepeat,
      `before=${allocsBeforeRepeat} after=${allocsAfterRepeat}`);

    // ============================================================
    // Scenario 6: fresh company without init — WZ on legacy stock → COSTING_NOT_INITIALIZED
    // ============================================================
    const companyB = await Company.create({ name: `Costing Flows Smoke B ${suffix}` }, { transaction: t });
    const companyBId = companyB.id;
    // Note: NO costingInitializedAt set for companyB.
    await CompanyWarehouseDocumentSetting.create(
      { companyId: companyBId, inventoryCostMethod: 'FIFO' }, // costingInitializedAt left null
      { transaction: t }
    );
    const whB = await Warehouse.create(
      { id: crypto.randomUUID(), companyId: companyBId, code: 'CF-WB', name: 'B', isActive: true },
      { transaction: t }
    );
    const locB1 = await Location.create(
      { id: crypto.randomUUID(), companyId: companyBId, warehouseId: whB.id, code: 'LB1', type: 'bulk' },
      { transaction: t }
    );
    const productB = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId: companyBId,
        name: 'B Legacy',
        slug: `b-legacy-${suffix}`,
        sku: 'CF-B1',
        cost: 10,
      },
      { transaction: t }
    );
    // Seed legacy inventory directly (mimics pre-costing data state).
    await InventoryItem.create(
      {
        companyId: companyBId,
        warehouseId: whB.id,
        locationId: locB1.id,
        productId: productB.id,
        qtyOnHand: 5,
        qtyReserved: 0,
      },
      { transaction: t }
    );

    const wzB = await shipmentService.create(
      companyBId,
      { warehouseId: whB.id, items: [{ productId: productB.id, qty: 1 }] },
      t
    );
    // Use savepoint isolation so the partial inventory mutation inside the failing shipItem
    // rolls back (matches production where each shipItem opens its own transaction).
    await expectAppErrorIsolated(
      'WZ before opening init on legacy stock → COSTING_NOT_INITIALIZED',
      'COSTING_NOT_INITIALIZED',
      t,
      (sp) => shipmentService.shipItem(companyBId, wzB.items[0].id, { qty: 1, fromLocationId: locB1.id }, sp)
    );

    // ============================================================
    // Scenario 7: run opening init → WZ works
    // ============================================================
    const initResult = await openingBalanceService.initializeForCompany(
      companyBId, {}, { transaction: t }
    );
    check('opening init creates 1 OPENING layer (5 × 10)',
      initResult.itemsCount === 1 && n(initResult.totalValue) === 50,
      `items=${initResult.itemsCount} value=${initResult.totalValue}`);

    // Now WZ should work.
    const wzB2 = await shipmentService.create(
      companyBId,
      { warehouseId: whB.id, items: [{ productId: productB.id, qty: 2 }] },
      t
    );
    await shipmentService.shipItem(
      companyBId, wzB2.items[0].id, { qty: 2, fromLocationId: locB1.id }, t
    );
    const wzBMove = await StockMove.findOne({
      where: { companyId: companyBId, refType: 'WZ', refId: wzB2.id, type: 'ship' },
      transaction: t,
    });
    check('after opening init, WZ ships 2 → totalCost=20 (2 × 10 OPENING)',
      wzBMove && n(wzBMove.totalCost) === 20 && n(wzBMove.unitCost) === 10,
      `total=${wzBMove && wzBMove.totalCost}`);
  } catch (error) {
    check('script execution', false, error && error.message);
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    if (t) {
      await t.rollback();
      // eslint-disable-next-line no-console
      console.log('-- transaction rolled back (zero pollution expected) --');
    }
    await sequelize.close();
  }

  const failed = results.filter((row) => !row.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();
