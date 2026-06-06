'use strict';

// Standalone runtime smoke for costingService reverse helpers (K1.2).
// NON-DESTRUCTIVE: everything runs inside one transaction and is ALWAYS rolled back.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeCostingReverse.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  CostLayer,
  Location,
  Product,
  StockMove,
  StockMoveCostAllocation,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const costingService = require('../src/services/wms/costingService');

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

async function createMove(payload, transaction) {
  return StockMove.create(
    {
      companyId: payload.companyId,
      type: payload.type,
      warehouseId: payload.warehouseId,
      fromLocationId: payload.fromLocationId || null,
      toLocationId: payload.toLocationId || null,
      productId: payload.productId,
      variantId: payload.variantId ?? null,
      lotId: payload.lotId ?? null,
      serialId: payload.serialId ?? null,
      qty: payload.qty,
      refType: payload.refType || null,
      refId: payload.refId || crypto.randomUUID(),
      refItemId: payload.refItemId || crypto.randomUUID(),
    },
    { transaction }
  );
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `K1.2 Reverse Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouse = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'K12-WH', name: 'K1.2 WH', isActive: true },
      { transaction: t }
    );
    const locA = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: warehouse.id, code: 'K12-A', type: 'bulk' },
      { transaction: t }
    );
    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'K1.2 Reverse Product',
        slug: `k12-rev-${suffix}`,
        sku: 'K12-1',
      },
      { transaction: t }
    );

    // ============================================================
    // Scenario A: outgoing reverse (PZ 10×20 → WZ 3 → reverseOutgoingConsumption)
    // ============================================================
    const aPz = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: product.id, qty: 10, refType: 'PZ' },
      t
    );
    const aPzResult = await costingService.createIncomingLayer(aPz, { unitCost: 20, currency: 'PLN' }, t);
    const aLayer = aPzResult.layer;

    const aWz = await createMove(
      { companyId, type: 'ship', warehouseId: warehouse.id, fromLocationId: locA.id, productId: product.id, qty: 3, refType: 'WZ' },
      t
    );
    await costingService.consumeFifoLayers(aWz, t);
    const aLayerAfterShip = await CostLayer.findByPk(aLayer.id, { transaction: t });
    check('A setup: layer qtyRemaining=7 after WZ ship 3',
      n(aLayerAfterShip.qtyRemaining) === 7, `remaining=${aLayerAfterShip.qtyRemaining}`);

    const aWzk = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: product.id, qty: 3, refType: 'WZ_KOREKTA' },
      t
    );
    const aReverse = await costingService.reverseOutgoingConsumption(aWz, aWzk, t);
    const aLayerAfterRev = await CostLayer.findByPk(aLayer.id, { transaction: t });
    const aAllocs = await StockMoveCostAllocation.findAll({
      where: { stockMoveId: aWz.id }, transaction: t,
    });
    check('A: layer qtyRemaining restored 7 → 10',
      n(aLayerAfterRev.qtyRemaining) === 10, `remaining=${aLayerAfterRev.qtyRemaining}`);
    check('A: allocation.reversedAt set, reversedByStockMoveId = aWzk.id',
      aAllocs.length === 1
        && aAllocs[0].reversedAt instanceof Date
        && aAllocs[0].reversedByStockMoveId === aWzk.id,
      `allocs=${aAllocs.length} reversedAt=${aAllocs[0] && aAllocs[0].reversedAt} ref=${aAllocs[0] && aAllocs[0].reversedByStockMoveId}`);
    const aWzkFresh = await StockMove.findByPk(aWzk.id, { transaction: t });
    check('A: reversingMove totalCost=60, unitCost=20, costMethod=FIFO',
      n(aWzkFresh.totalCost) === 60 && n(aWzkFresh.unitCost) === 20 && aWzkFresh.costMethod === 'FIFO',
      `total=${aWzkFresh.totalCost} unit=${aWzkFresh.unitCost} m=${aWzkFresh.costMethod}`);
    check('A: reversingMove.reversesMoveId = original WZ',
      aWzkFresh.reversesMoveId === aWz.id, `ref=${aWzkFresh.reversesMoveId}`);
    check('A: aReverse.skipped=false on first call', aReverse.skipped === false);

    // Idempotency: repeat reverseOutgoingConsumption
    const aReverseAgain = await costingService.reverseOutgoingConsumption(aWz, aWzk, t);
    const aLayerAfterRepeat = await CostLayer.findByPk(aLayer.id, { transaction: t });
    const aAllocsAfterRepeat = await StockMoveCostAllocation.findAll({
      where: { stockMoveId: aWz.id }, transaction: t,
    });
    check('A idempotent: layer qtyRemaining stays at 10 (not 13)',
      n(aLayerAfterRepeat.qtyRemaining) === 10, `remaining=${aLayerAfterRepeat.qtyRemaining}`);
    check('A idempotent: allocations count unchanged',
      aAllocsAfterRepeat.length === 1, `allocs=${aAllocsAfterRepeat.length}`);
    check('A idempotent: aReverseAgain.skipped=true',
      aReverseAgain.skipped === true);

    // ============================================================
    // Scenario B: incoming reverse (PZ 10×20 → reverseIncomingLayer, no consumption)
    // ============================================================
    const bPz = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: product.id, qty: 10, refType: 'PZ' },
      t
    );
    const bPzResult = await costingService.createIncomingLayer(bPz, { unitCost: 20, currency: 'PLN' }, t);
    const bLayer = bPzResult.layer;

    const bPzk = await createMove(
      { companyId, type: 'ship', warehouseId: warehouse.id, fromLocationId: locA.id, productId: product.id, qty: 10, refType: 'PZ_KOREKTA' },
      t
    );
    const bReverse = await costingService.reverseIncomingLayer(bPz, bPzk, t);
    const bLayerAfter = await CostLayer.findByPk(bLayer.id, { transaction: t });
    check('B: layer qtyRemaining 10 → 0',
      n(bLayerAfter.qtyRemaining) === 0, `remaining=${bLayerAfter.qtyRemaining}`);
    const bPzkFresh = await StockMove.findByPk(bPzk.id, { transaction: t });
    check('B: reversingMove totalCost=200, unitCost=20, costMethod=FIFO',
      n(bPzkFresh.totalCost) === 200 && n(bPzkFresh.unitCost) === 20 && bPzkFresh.costMethod === 'FIFO',
      `total=${bPzkFresh.totalCost} unit=${bPzkFresh.unitCost} m=${bPzkFresh.costMethod}`);
    check('B: reversingMove.reversesMoveId = original PZ',
      bPzkFresh.reversesMoveId === bPz.id);
    check('B: bReverse.skipped=false on first call', bReverse.skipped === false);

    const bReverseAgain = await costingService.reverseIncomingLayer(bPz, bPzk, t);
    const bLayerAfterRepeat = await CostLayer.findByPk(bLayer.id, { transaction: t });
    check('B idempotent: layer.qtyRemaining stays 0',
      n(bLayerAfterRepeat.qtyRemaining) === 0);
    check('B idempotent: bReverseAgain.skipped=true', bReverseAgain.skipped === true);

    // ============================================================
    // Scenario C: incoming reverse blocked by partial consumption
    // Uses a fresh product so previous scenarios' layers (A still at qtyRemaining=10)
    // don't catch the FIFO consumption instead of C's own layer.
    // ============================================================
    const cProduct = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'K1.2 Partial-Consume Product',
        slug: `k12-partial-${suffix}`,
        sku: 'K12-C',
      },
      { transaction: t }
    );
    const cPz = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: cProduct.id, qty: 10, refType: 'PZ' },
      t
    );
    await costingService.createIncomingLayer(cPz, { unitCost: 20, currency: 'PLN' }, t);
    const cWz = await createMove(
      { companyId, type: 'ship', warehouseId: warehouse.id, fromLocationId: locA.id, productId: cProduct.id, qty: 3, refType: 'WZ' },
      t
    );
    await costingService.consumeFifoLayers(cWz, t);

    const cPzk = await createMove(
      { companyId, type: 'ship', warehouseId: warehouse.id, fromLocationId: locA.id, productId: cProduct.id, qty: 10, refType: 'PZ_KOREKTA' },
      t
    );
    await expectAppError(
      'C: reverseIncomingLayer on partially-consumed layer → 409 LAYER_PARTIALLY_CONSUMED',
      'LAYER_PARTIALLY_CONSUMED',
      () => costingService.reverseIncomingLayer(cPz, cPzk, t)
    );

    // ============================================================
    // Scenario D: multi-allocation outgoing reverse (5×20 + 5×15, WZ 7 → 2 allocations)
    // ============================================================
    const dProduct = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'K1.2 Multi-Layer Product',
        slug: `k12-multi-${suffix}`,
        sku: 'K12-2',
      },
      { transaction: t }
    );
    const dPz1 = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: dProduct.id, qty: 5, refType: 'PZ' },
      t
    );
    const dPz1Result = await costingService.createIncomingLayer(dPz1, { unitCost: 20, currency: 'PLN' }, t);
    const dLayer1 = dPz1Result.layer;
    const dPz2 = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: dProduct.id, qty: 5, refType: 'PZ' },
      t
    );
    const dPz2Result = await costingService.createIncomingLayer(dPz2, { unitCost: 15, currency: 'PLN' }, t);
    const dLayer2 = dPz2Result.layer;

    const dWz = await createMove(
      { companyId, type: 'ship', warehouseId: warehouse.id, fromLocationId: locA.id, productId: dProduct.id, qty: 7, refType: 'WZ' },
      t
    );
    const dConsume = await costingService.consumeFifoLayers(dWz, t);
    check('D setup: WZ produces 2 allocations (5@20 + 2@15)',
      dConsume.allocations.length === 2, `allocs=${dConsume.allocations.length}`);

    const dWzk = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: dProduct.id, qty: 7, refType: 'WZ_KOREKTA' },
      t
    );
    const dReverse = await costingService.reverseOutgoingConsumption(dWz, dWzk, t);
    const dLayer1After = await CostLayer.findByPk(dLayer1.id, { transaction: t });
    const dLayer2After = await CostLayer.findByPk(dLayer2.id, { transaction: t });
    check('D: layer1 qtyRemaining restored 0 → 5',
      n(dLayer1After.qtyRemaining) === 5, `l1=${dLayer1After.qtyRemaining}`);
    check('D: layer2 qtyRemaining restored 3 → 5',
      n(dLayer2After.qtyRemaining) === 5, `l2=${dLayer2After.qtyRemaining}`);
    const dWzkFresh = await StockMove.findByPk(dWzk.id, { transaction: t });
    check('D: reversingMove totalCost=130 (5×20 + 2×15)',
      n(dWzkFresh.totalCost) === 130, `total=${dWzkFresh.totalCost}`);
    check('D: reversingMove unitCost = weighted avg 130/7 ≈ 18.5714',
      Math.abs(n(dWzkFresh.unitCost) - 18.5714) < 0.001, `unit=${dWzkFresh.unitCost}`);

    const dAllocs = await StockMoveCostAllocation.findAll({
      where: { stockMoveId: dWz.id }, transaction: t,
    });
    const allReversed = dAllocs.every(
      (a) => a.reversedAt instanceof Date && a.reversedByStockMoveId === dWzk.id
    );
    check('D: both allocations soft-marked reversedAt + reversedByStockMoveId',
      dAllocs.length === 2 && allReversed,
      `allocs=${dAllocs.length} allReversed=${allReversed}`);
    check('D: dReverse.createdReversals=2 (both allocations processed)',
      dReverse.createdReversals === 2);

    // ============================================================
    // Scenario E: K1.2 audit-spec named-args public API — reverseConsumption({...})
    // ============================================================
    const eProduct = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'K1.2 Named-Args Product',
        slug: `k12-named-${suffix}`,
        sku: 'K12-E',
      },
      { transaction: t }
    );
    const ePz = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: eProduct.id, qty: 10, refType: 'PZ' },
      t
    );
    await costingService.createIncomingLayer(ePz, { unitCost: 20, currency: 'PLN' }, t);
    const eWz = await createMove(
      { companyId, type: 'ship', warehouseId: warehouse.id, fromLocationId: locA.id, productId: eProduct.id, qty: 4, refType: 'WZ' },
      t
    );
    await costingService.consumeFifoLayers(eWz, t);

    const eWzk = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: eProduct.id, qty: 4, refType: 'WZ_KOREKTA' },
      t
    );
    const eSummary = await costingService.reverseConsumption({
      transaction: t,
      originalStockMoveId: eWz.id,
      reversingStockMoveId: eWzk.id,
    });
    check('E (named-args): allocationsReversed=1',
      eSummary.allocationsReversed === 1, `n=${eSummary.allocationsReversed}`);
    check('E (named-args): qtyRestored=4',
      n(eSummary.qtyRestored) === 4, `q=${eSummary.qtyRestored}`);
    check('E (named-args): valueRestored=80 (4×20)',
      n(eSummary.valueRestored) === 80, `v=${eSummary.valueRestored}`);

    // Also exercise the named-args form of reverseIncomingLayer.
    const fProduct = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'K1.2 Named-Args Incoming Product',
        slug: `k12-named-in-${suffix}`,
        sku: 'K12-F',
      },
      { transaction: t }
    );
    const fPz = await createMove(
      { companyId, type: 'receipt', warehouseId: warehouse.id, toLocationId: locA.id, productId: fProduct.id, qty: 10, refType: 'PZ' },
      t
    );
    await costingService.createIncomingLayer(fPz, { unitCost: 25, currency: 'PLN' }, t);
    const fPzk = await createMove(
      { companyId, type: 'ship', warehouseId: warehouse.id, fromLocationId: locA.id, productId: fProduct.id, qty: 10, refType: 'PZ_KOREKTA' },
      t
    );
    const fSummary = await costingService.reverseIncomingLayer({
      transaction: t,
      originalStockMoveId: fPz.id,
      reversingStockMoveId: fPzk.id,
    });
    check('F (named-args reverseIncomingLayer): layerId set',
      typeof fSummary.layerId === 'string' && fSummary.layerId.length > 0,
      `id=${fSummary.layerId}`);
    check('F (named-args reverseIncomingLayer): qtyRemoved=10',
      n(fSummary.qtyRemoved) === 10, `q=${fSummary.qtyRemoved}`);
    check('F (named-args reverseIncomingLayer): valueRemoved=250 (10×25)',
      n(fSummary.valueRemoved) === 250, `v=${fSummary.valueRemoved}`);
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
