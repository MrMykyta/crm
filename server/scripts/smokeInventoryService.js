'use strict';

// Standalone runtime smoke for WMS inventoryService (Phase 0 / T0.6).
//
// Self-contained and NON-DESTRUCTIVE: it creates a temporary warehouse + 2 locations
// and performs stock moves inside a single transaction that is ALWAYS ROLLED BACK.
// Nothing is persisted to the database.
//
// Requires a reachable Postgres (DB_* env). Not wired into `npm run smoke` on purpose
// (that pipeline boots the full app and has different env/DB expectations).
//
// Run (inside the backend container, where DB env is configured):
//   docker exec crm_backend node scripts/smokeInventoryService.js

const crypto = require('crypto');
const { sequelize, Warehouse, Location, InventoryItem } = require('../src/models');
const inv = require('../src/services/wms/inventoryService');
const AppError = require('../src/errors/AppError');

const results = [];
function check(name, cond, extra) {
  const ok = !!cond;
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function expectInsufficient(name, fn) {
  try {
    await fn();
    check(name, false, 'no error thrown');
  } catch (e) {
    const ok = e instanceof AppError && e.statusCode === 409 && e.code === 'INSUFFICIENT_STOCK';
    check(name, ok, `status=${e.statusCode} code=${e.code} msg="${e.message}"`);
  }
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();

    const [companies] = await sequelize.query('SELECT id FROM companies LIMIT 1');
    if (!companies.length) throw new Error('no company in DB to attach the test warehouse');
    const companyId = companies[0].id;

    const productId = crypto.randomUUID();
    const warehouseId = crypto.randomUUID();
    const locA = crypto.randomUUID();
    const locB = crypto.randomUUID();
    const key = { companyId, warehouseId, productId, variantId: null };

    t = await sequelize.transaction();

    await Warehouse.create(
      { id: warehouseId, companyId, code: 'T0SMOKE', name: 'Phase0 Smoke WH', isActive: true },
      { transaction: t }
    );
    await Location.create({ id: locA, companyId, warehouseId, code: 'A', type: 'bulk' }, { transaction: t });
    await Location.create({ id: locB, companyId, warehouseId, code: 'B', type: 'bulk' }, { transaction: t });

    // 1) receipt → locA qty 10
    const mv1 = await inv.applyMove(
      { companyId, type: 'receipt', warehouseId, toLocationId: locA, productId, qty: 10, refType: 'PZ', refId: warehouseId },
      { transaction: t }
    );
    check('receipt creates StockMove with type', mv1 && mv1.type === 'receipt', `type=${mv1 && mv1.type}`);
    check('receipt move has refType/refId', mv1 && mv1.refType === 'PZ' && mv1.refId === warehouseId);
    check('receipt increases on_hand to 10', (await inv.getOnHand(key, { transaction: t })) === 10);
    const rowA1 = await InventoryItem.findOne({ where: { warehouseId, locationId: locA, productId, variantId: null }, transaction: t });
    check('inventory_items row A qty_on_hand = 10', rowA1 && Number(rowA1.qtyOnHand) === 10, `A=${rowA1 && rowA1.qtyOnHand}`);

    // 2) transfer locA → locB qty 4
    await inv.applyMove(
      { companyId, type: 'transfer', warehouseId, fromLocationId: locA, toLocationId: locB, productId, qty: 4, refType: 'MM', refId: warehouseId },
      { transaction: t }
    );
    const rowA2 = await InventoryItem.findOne({ where: { warehouseId, locationId: locA, productId, variantId: null }, transaction: t });
    const rowB2 = await InventoryItem.findOne({ where: { warehouseId, locationId: locB, productId, variantId: null }, transaction: t });
    check('transfer decrements from A to 6', rowA2 && Number(rowA2.qtyOnHand) === 6, `A=${rowA2 && rowA2.qtyOnHand}`);
    check('transfer increments to B to 4', rowB2 && Number(rowB2.qtyOnHand) === 4, `B=${rowB2 && rowB2.qtyOnHand}`);
    check('on_hand still 10 after intra-warehouse transfer', (await inv.getOnHand(key, { transaction: t })) === 10);

    // 3) reserved / available
    check('getReserved = 0 (no active reservations)', (await inv.getReserved(key, { transaction: t })) === 0);
    check('getAvailable = onHand - reserved = 10', (await inv.getAvailable(key, { transaction: t })) === 10);

    // 4) oversell vs available (warehouse-level guard)
    await expectInsufficient('ship 100 > available(10) → 409 INSUFFICIENT_STOCK', () =>
      inv.applyMove({ companyId, type: 'ship', warehouseId, fromLocationId: locA, productId, qty: 100, refType: 'WZ', refId: warehouseId }, { transaction: t }));

    // 5) location oversell (B holds 4, available is 10) → location-level guard
    await expectInsufficient('ship 5 from B (only 4 at B) → 409 INSUFFICIENT_STOCK', () =>
      inv.applyMove({ companyId, type: 'ship', warehouseId, fromLocationId: locB, productId, qty: 5, refType: 'WZ', refId: warehouseId }, { transaction: t }));

    // 6) sanity: failed ships mutated nothing
    check('on_hand unchanged (10) after failed ships', (await inv.getOnHand(key, { transaction: t })) === 10);
  } catch (e) {
    check('script execution', false, e && e.message);
    // eslint-disable-next-line no-console
    console.error(e);
  } finally {
    if (t) {
      await t.rollback();
      // eslint-disable-next-line no-console
      console.log('-- transaction rolled back (no data persisted) --');
    }
    await sequelize.close();
  }

  const failed = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();
