'use strict';

// Standalone runtime smoke for inventory cycle count reconcile (F1).
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
// Run in backend container:
//   docker compose exec backend node scripts/smokeInventoryCount.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Warehouse,
  Location,
  Product,
  StockMove,
} = require('../src/models');

const inventoryService = require('../src/services/wms/inventoryService');
const inventoryCountService = require('../src/services/wms/inventoryCountService');

const results = [];

function check(name, cond, extra = '') {
  const ok = Boolean(cond);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const company = await Company.create({ name: 'Inventory Count Smoke' }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'COUNT-WH',
        name: 'Count Warehouse',
        isActive: true,
      },
      { transaction: t }
    );

    const location = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'COUNT-A1',
        type: 'bulk',
      },
      { transaction: t }
    );

    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'Count Smoke Product',
        slug: `count-smoke-${Date.now()}`,
        sku: 'COUNT-SKU',
      },
      { transaction: t }
    );

    await inventoryService.applyMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: location.id,
        productId: product.id,
        qty: 10,
        refType: 'PZ',
        refId: crypto.randomUUID(),
        refItemId: crypto.randomUUID(),
      },
      { transaction: t }
    );

    const onHandAfterPz = await inventoryService.getOnHand(
      { companyId, warehouseId: warehouse.id, productId: product.id, variantId: null },
      { transaction: t }
    );
    check('PZ +10 seeds onHand=10', toNumber(onHandAfterPz) === 10, `onHand=${onHandAfterPz}`);

    const cycleA = await inventoryCountService.createCycleCount(
      companyId,
      {
        warehouseId: warehouse.id,
        items: [
          {
            locationId: location.id,
            productId: product.id,
            qtyCounted: 7,
          },
        ],
      },
      { transaction: t }
    );
    check('Cycle count A created', Boolean(cycleA?.id));
    check('Cycle count A has 1 item', Array.isArray(cycleA?.items) && cycleA.items.length === 1);

    const reconcileA = await inventoryCountService.reconcileCycleCount(cycleA.id, {
      companyId,
      transaction: t,
    });
    const rwAdjustment = (reconcileA.adjustments || []).find((row) => row.documentType === 'RW');
    check('Reconcile A creates RW adjustment', Boolean(rwAdjustment?.id));

    const onHandAfterRw = await inventoryService.getOnHand(
      { companyId, warehouseId: warehouse.id, productId: product.id, variantId: null },
      { transaction: t }
    );
    check('Reconcile A RW -3 => onHand=7', toNumber(onHandAfterRw) === 7, `onHand=${onHandAfterRw}`);

    const rwMovesBeforeRepeat = await StockMove.count({
      where: {
        companyId,
        type: 'adjustment',
        refType: 'RW',
        refId: rwAdjustment.id,
      },
      transaction: t,
    });

    const reconcileARepeat = await inventoryCountService.reconcileCycleCount(cycleA.id, {
      companyId,
      transaction: t,
    });
    const onHandAfterRepeat = await inventoryService.getOnHand(
      { companyId, warehouseId: warehouse.id, productId: product.id, variantId: null },
      { transaction: t }
    );
    const rwMovesAfterRepeat = await StockMove.count({
      where: {
        companyId,
        type: 'adjustment',
        refType: 'RW',
        refId: rwAdjustment.id,
      },
      transaction: t,
    });

    check(
      'Repeat reconcile returns no new adjustments',
      Array.isArray(reconcileARepeat.adjustments) && reconcileARepeat.adjustments.length === 0
    );
    check('Repeat reconcile keeps onHand=7', toNumber(onHandAfterRepeat) === 7, `onHand=${onHandAfterRepeat}`);
    check(
      'Repeat reconcile does not duplicate RW stock_moves',
      rwMovesBeforeRepeat === rwMovesAfterRepeat,
      `before=${rwMovesBeforeRepeat}, after=${rwMovesAfterRepeat}`
    );

    const cycleB = await inventoryCountService.createCycleCount(
      companyId,
      {
        warehouseId: warehouse.id,
        items: [
          {
            locationId: location.id,
            productId: product.id,
            qtyCounted: 12,
          },
        ],
      },
      { transaction: t }
    );
    const reconcileB = await inventoryCountService.reconcileCycleCount(cycleB.id, {
      companyId,
      transaction: t,
    });
    const pwAdjustment = (reconcileB.adjustments || []).find((row) => row.documentType === 'PW');
    check('Reconcile B creates PW adjustment', Boolean(pwAdjustment?.id));

    const onHandAfterPw = await inventoryService.getOnHand(
      { companyId, warehouseId: warehouse.id, productId: product.id, variantId: null },
      { transaction: t }
    );
    check('Reconcile B PW +5 => onHand=12', toNumber(onHandAfterPw) === 12, `onHand=${onHandAfterPw}`);
  } catch (error) {
    check('script execution', false, error?.message);
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

  const failed = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();

