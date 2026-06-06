'use strict';

// Standalone runtime smoke for WMS FIFO costingService (G1.2).
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeCostingServiceFifo.js

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

function n(value) {
  return Number(value);
}

async function expectCostMethodError(name, fn) {
  try {
    await fn();
    check(name, false, 'no error thrown');
  } catch (error) {
    check(
      name,
      error instanceof AppError && error.statusCode === 409 && error.code === 'COST_METHOD_NOT_IMPLEMENTED',
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
    const company = await Company.create({ name: `FIFO Cost Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;

    await CompanyWarehouseDocumentSetting.create(
      {
        companyId,
        warehouseDefaultDocumentType: 'wz',
        inventoryCostMethod: 'FIFO',
        // This smoke exercises costingService in isolation (PZ/PW/WZ/RW/MM scenarios with
        // explicit move payloads), not the opening-balance flow. Pre-set costingInitializedAt
        // so assertCostingInitialized (gate added in G1.2d) doesn't block consumeFifoLayers /
        // transferFifoLayers. The full opening flow is verified in smokeCostingOpeningBalance.js.
        costingInitializedAt: new Date(),
      },
      { transaction: t }
    );

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'FIFO-WH',
        name: 'FIFO Cost Smoke Warehouse',
        isActive: true,
      },
      { transaction: t }
    );

    const locA = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'FIFO-A',
        type: 'bulk',
      },
      { transaction: t }
    );
    const locB = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'FIFO-B',
        type: 'bulk',
      },
      { transaction: t }
    );

    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'FIFO Cost Smoke Product',
        slug: `fifo-cost-smoke-product-${suffix}`,
        sku: 'FIFO-COST-1',
      },
      { transaction: t }
    );

    const incoming = await createMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: product.id,
        qty: 10,
        refType: 'PZ',
      },
      t
    );

    const incomingResult = await costingService.createIncomingLayer(
      incoming,
      { unitCost: 20, currency: 'PLN' },
      t
    );
    check('incoming layer 10×20 created', incomingResult.created === true && n(incomingResult.layer.qtyRemaining) === 10);
    check('incoming move cost snapshot total=200', n(incomingResult.move.totalCost) === 200, `total=${incomingResult.move.totalCost}`);

    await costingService.createIncomingLayer(incoming, { unitCost: 20, currency: 'PLN' }, t);
    const incomingLayerCount = await CostLayer.count({ where: { sourceMoveId: incoming.id }, transaction: t });
    check('incoming idempotency does not duplicate layer', incomingLayerCount === 1, `layers=${incomingLayerCount}`);

    const shipMove = await createMove(
      {
        companyId,
        type: 'ship',
        warehouseId: warehouse.id,
        fromLocationId: locA.id,
        productId: product.id,
        qty: 3,
        refType: 'WZ',
      },
      t
    );
    const shipCost = await costingService.consumeFifoLayers(shipMove, t);
    const firstLayerAfterShip = await CostLayer.findByPk(incomingResult.layer.id, { transaction: t });
    check('consume 3 from 10×20 => cost 60', n(shipCost.totalCost) === 60, `total=${shipCost.totalCost}`);
    check('consume creates one allocation', shipCost.allocations.length === 1, `allocations=${shipCost.allocations.length}`);
    check('consume reduces layer qtyRemaining to 7', n(firstLayerAfterShip.qtyRemaining) === 7, `remaining=${firstLayerAfterShip.qtyRemaining}`);

    await costingService.consumeFifoLayers(shipMove, t);
    const repeatAllocCount = await StockMoveCostAllocation.count({ where: { stockMoveId: shipMove.id }, transaction: t });
    const firstLayerAfterRepeat = await CostLayer.findByPk(incomingResult.layer.id, { transaction: t });
    check('consume idempotency does not duplicate allocations', repeatAllocCount === 1, `allocations=${repeatAllocCount}`);
    check('consume idempotency does not decrement layer again', n(firstLayerAfterRepeat.qtyRemaining) === 7, `remaining=${firstLayerAfterRepeat.qtyRemaining}`);

    const secondIncoming = await createMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: product.id,
        qty: 5,
        refType: 'PZ',
      },
      t
    );
    await costingService.createIncomingLayer(secondIncoming, { unitCost: 30, currency: 'PLN' }, t);

    const multiShipMove = await createMove(
      {
        companyId,
        type: 'ship',
        warehouseId: warehouse.id,
        fromLocationId: locA.id,
        productId: product.id,
        qty: 10,
        refType: 'WZ',
      },
      t
    );
    const multiCost = await costingService.consumeFifoLayers(multiShipMove, t);
    check('consume multiple FIFO layers creates two allocations', multiCost.allocations.length === 2, `allocations=${multiCost.allocations.length}`);
    check('consume multiple FIFO layers total cost 230', n(multiCost.totalCost) === 230, `total=${multiCost.totalCost}`);

    const transferProduct = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'FIFO Cost Transfer Product',
        slug: `fifo-cost-transfer-product-${suffix}`,
        sku: 'FIFO-COST-2',
      },
      { transaction: t }
    );
    const transferIncoming = await createMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: transferProduct.id,
        qty: 6,
        refType: 'PZ',
      },
      t
    );
    const transferSource = await costingService.createIncomingLayer(
      transferIncoming,
      { unitCost: 12, currency: 'PLN' },
      t
    );

    const transferOut = await createMove(
      {
        companyId,
        type: 'transfer',
        warehouseId: warehouse.id,
        fromLocationId: locA.id,
        productId: transferProduct.id,
        qty: 4,
        refType: 'MM',
      },
      t
    );
    const transferIn = await createMove(
      {
        companyId,
        type: 'transfer',
        warehouseId: warehouse.id,
        toLocationId: locB.id,
        productId: transferProduct.id,
        qty: 4,
        refType: 'MM',
        refId: transferOut.refId,
        refItemId: transferOut.refItemId,
      },
      t
    );

    const transferCost = await costingService.transferFifoLayers(transferOut, transferIn, t);
    const transferSourceAfter = await CostLayer.findByPk(transferSource.layer.id, { transaction: t });
    check('MM transfer source layer reduced 6 -> 2', n(transferSourceAfter.qtyRemaining) === 2, `remaining=${transferSourceAfter.qtyRemaining}`);
    check('MM single-source transfer creates exactly 1 target layer (qty 4)',
      transferCost.targetLayers.length === 1 && n(transferCost.targetLayers[0].qtyRemaining) === 4,
      `targetLayers=${transferCost.targetLayers.length} qty=${transferCost.targetLayers[0] && transferCost.targetLayers[0].qtyRemaining}`);
    check('MM single-source target layer keeps source unit_cost (12)',
      n(transferCost.targetLayers[0].unitCost) === 12,
      `unitCost=${transferCost.targetLayers[0].unitCost}`);
    check('MM single-source target layer links to source allocation',
      Boolean(transferCost.targetLayers[0].sourceAllocationId)
        && transferCost.targetLayers[0].sourceAllocationId === transferCost.allocations[0].id,
      `sourceAllocationId=${transferCost.targetLayers[0].sourceAllocationId}`);
    check('MM transfer keeps moved value 4×12=48', n(transferCost.totalCost) === 48, `total=${transferCost.totalCost}`);

    await costingService.transferFifoLayers(transferOut, transferIn, t);
    const transferOutAllocCount = await StockMoveCostAllocation.count({ where: { stockMoveId: transferOut.id }, transaction: t });
    const transferTargetLayerCount = await CostLayer.count({ where: { sourceMoveId: transferIn.id }, transaction: t });
    const transferSourceAfterRepeat = await CostLayer.findByPk(transferSource.layer.id, { transaction: t });
    check('MM transfer idempotency does not duplicate allocations', transferOutAllocCount === 1, `allocations=${transferOutAllocCount}`);
    check('MM transfer idempotency does not duplicate target layer', transferTargetLayerCount === 1, `targetLayers=${transferTargetLayerCount}`);
    check('MM transfer idempotency does not decrement source again', n(transferSourceAfterRepeat.qtyRemaining) === 2, `remaining=${transferSourceAfterRepeat.qtyRemaining}`);

    // --- MM transfer consuming TWO source FIFO layers ---
    // Setup: 5×20 + 5×15 incoming, then transfer qty=7 from locA -> locB.
    // Expected:
    //   outMove consumes 5×20 + 2×15 → 2 allocations on outMove
    //   inMove creates 2 target layers at locB: (5 @ 20) and (2 @ 15)
    //   target total value = 130
    //   company total stock value unchanged across transfer
    const multiProduct = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'FIFO MM Multi-Layer Product',
        slug: `fifo-mm-multi-product-${suffix}`,
        sku: 'FIFO-MM-MULTI',
      },
      { transaction: t }
    );

    const mmIncomingA = await createMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: multiProduct.id,
        qty: 5,
        refType: 'PZ',
      },
      t
    );
    await costingService.createIncomingLayer(mmIncomingA, { unitCost: 20, currency: 'PLN' }, t);

    const mmIncomingB = await createMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: multiProduct.id,
        qty: 5,
        refType: 'PZ',
      },
      t
    );
    await costingService.createIncomingLayer(mmIncomingB, { unitCost: 15, currency: 'PLN' }, t);

    async function sumProductStockValue(productId, transaction) {
      const layers = await CostLayer.findAll({
        where: { companyId, productId },
        transaction,
      });
      return layers.reduce((sum, layer) => sum + n(layer.qtyRemaining) * n(layer.unitCost), 0);
    }

    const preTransferValue = await sumProductStockValue(multiProduct.id, t);
    check('multi-layer pre-transfer company value = 5×20 + 5×15 = 175',
      Math.round(preTransferValue * 100) === 17500, `pre=${preTransferValue}`);

    const mmOutMulti = await createMove(
      {
        companyId,
        type: 'transfer',
        warehouseId: warehouse.id,
        fromLocationId: locA.id,
        productId: multiProduct.id,
        qty: 7,
        refType: 'MM',
      },
      t
    );
    const mmInMulti = await createMove(
      {
        companyId,
        type: 'transfer',
        warehouseId: warehouse.id,
        toLocationId: locB.id,
        productId: multiProduct.id,
        qty: 7,
        refType: 'MM',
        refId: mmOutMulti.refId,
        refItemId: mmOutMulti.refItemId,
      },
      t
    );

    const mmMulti = await costingService.transferFifoLayers(mmOutMulti, mmInMulti, t);

    check('MM multi-source: outMove has 2 allocations (5×20 + 2×15)',
      mmMulti.allocations.length === 2, `allocations=${mmMulti.allocations.length}`);
    const allocTotal = mmMulti.allocations.reduce((s, a) => s + n(a.totalCost), 0);
    check('MM multi-source: allocations sum to 130',
      Math.round(allocTotal * 100) === 13000, `allocSum=${allocTotal}`);

    check('MM multi-source: inMove creates 2 target layers',
      mmMulti.targetLayers.length === 2, `targetLayers=${mmMulti.targetLayers.length}`);

    // Target layers are returned in receivedAt/createdAt/id ASC; both share the same receivedAt
    // (inMove.createdAt), so insertion order = allocation order = FIFO consumption order.
    const targets = mmMulti.targetLayers;
    const t1 = targets.find((l) => n(l.unitCost) === 20);
    const t2 = targets.find((l) => n(l.unitCost) === 15);
    check('MM multi-source: target layer 1 (5 @ 20)',
      t1 && n(t1.qtyRemaining) === 5 && n(t1.totalCost) === 100,
      `t1 qty=${t1 && t1.qtyRemaining} unitCost=${t1 && t1.unitCost} total=${t1 && t1.totalCost}`);
    check('MM multi-source: target layer 2 (2 @ 15)',
      t2 && n(t2.qtyRemaining) === 2 && n(t2.totalCost) === 30,
      `t2 qty=${t2 && t2.qtyRemaining} unitCost=${t2 && t2.unitCost} total=${t2 && t2.totalCost}`);

    check('MM multi-source: each target layer links to its source allocation',
      targets.every((l) => Boolean(l.sourceAllocationId)
        && mmMulti.allocations.some((a) => a.id === l.sourceAllocationId)),
      `sourceAllocationIds=${targets.map((l) => l.sourceAllocationId).join(',')}`);

    check('MM multi-source: target total value = 130',
      Math.round((n(t1.totalCost) + n(t2.totalCost)) * 100) === 13000);

    const postTransferValue = await sumProductStockValue(multiProduct.id, t);
    check('MM multi-source: company total stock value unchanged (175)',
      Math.round(postTransferValue * 100) === 17500, `post=${postTransferValue}`);

    // Idempotency: repeat does not add new target layers / allocations.
    await costingService.transferFifoLayers(mmOutMulti, mmInMulti, t);
    const mmMultiOutAllocCount = await StockMoveCostAllocation.count({
      where: { stockMoveId: mmOutMulti.id }, transaction: t,
    });
    const mmMultiTargetLayerCount = await CostLayer.count({
      where: { sourceMoveId: mmInMulti.id }, transaction: t,
    });
    check('MM multi-source idempotency: out allocations remain 2',
      mmMultiOutAllocCount === 2, `allocations=${mmMultiOutAllocCount}`);
    check('MM multi-source idempotency: target layers remain 2',
      mmMultiTargetLayerCount === 2, `targetLayers=${mmMultiTargetLayerCount}`);

    await CompanyWarehouseDocumentSetting.update(
      { inventoryCostMethod: 'AVCO' },
      { where: { companyId }, transaction: t }
    );
    const avcoMove = await createMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: transferProduct.id,
        qty: 1,
        refType: 'PZ',
      },
      t
    );
    await expectCostMethodError('AVCO setting returns COST_METHOD_NOT_IMPLEMENTED', () =>
      costingService.createIncomingLayer(avcoMove, { unitCost: 1, currency: 'PLN' }, t)
    );
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
