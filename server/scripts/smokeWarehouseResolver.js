'use strict';

// Standalone runtime smoke for WMS warehouseResolver (Phase 1 / T1.1).
//
// NON-DESTRUCTIVE: everything runs inside one transaction that is ALWAYS ROLLED BACK.
// Requires a reachable Postgres + the migration adding company_warehouse_document_settings.default_warehouse_id.
//
// Run inside the backend container (DB env configured there):
//   docker exec crm_backend node scripts/smokeWarehouseResolver.js

const crypto = require('crypto');
const { sequelize, Company, Warehouse, CompanyWarehouseDocumentSetting } = require('../src/models');
const { resolveDefaultWarehouseId } = require('../src/services/wms/warehouseResolver');
const inv = require('../src/services/wms/inventoryService');
const receiptService = require('../src/services/wms/receiptService');
const AppError = require('../src/errors/AppError');

const results = [];
function check(name, cond, extra) {
  const ok = !!cond;
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function upsertSetting(companyId, defaultWarehouseId, t) {
  const [row] = await CompanyWarehouseDocumentSetting.findOrCreate({
    where: { companyId },
    defaults: { companyId },
    transaction: t,
  });
  await row.update({ defaultWarehouseId }, { transaction: t });
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();

    t = await sequelize.transaction();

    // Temporary companies created inside the rollback transaction → smoke is self-contained
    // and works on a clean/empty DB (no pre-existing companies required). Company requires only `name`.
    const companyA = (await Company.create({ name: 'Phase1 Smoke Company A' }, { transaction: t })).id;
    const companyB = (await Company.create({ name: 'Phase1 Smoke Company B' }, { transaction: t })).id;

    // --- companyA: has explicit warehouses ---
    const w1 = await Warehouse.create(
      { id: crypto.randomUUID(), companyId: companyA, code: 'WHA1', name: 'WH A1', isActive: true },
      { transaction: t }
    );
    const w2 = await Warehouse.create(
      { id: crypto.randomUUID(), companyId: companyA, code: 'WHA2', name: 'WH A2', isActive: true },
      { transaction: t }
    );

    // 1) warehouse exists, no setting → fallback returns an active warehouse of the company
    const r1 = await resolveDefaultWarehouseId(companyA, { transaction: t });
    check('exists + no setting → returns an active company warehouse', [w1.id, w2.id].includes(r1), `r1=${r1}`);

    // 2) valid setting → returns exactly that warehouse
    await upsertSetting(companyA, w2.id, t);
    const r2 = await resolveDefaultWarehouseId(companyA, { transaction: t });
    check('valid defaultWarehouseId setting → returns it (w2)', r2 === w2.id, `r2=${r2} expected=${w2.id}`);

    // 3) stale setting → fallback to an active warehouse.
    //    A non-existent id is impossible (default_warehouse_id has an FK to warehouses), so the
    //    realistic "broken" case is a setting pointing to an INACTIVE warehouse of the company.
    const wInactive = await Warehouse.create(
      { id: crypto.randomUUID(), companyId: companyA, code: 'WHAX', name: 'WH A inactive', isActive: false },
      { transaction: t }
    );
    await upsertSetting(companyA, wInactive.id, t);
    const r3 = await resolveDefaultWarehouseId(companyA, { transaction: t });
    check('stale setting (inactive warehouse) → fallback to active warehouse', [w1.id, w2.id].includes(r3), `r3=${r3}`);

    // 4) company with no warehouse → creates MAIN
    const r4 = await resolveDefaultWarehouseId(companyB, { transaction: t });
    const main = await Warehouse.findByPk(r4, { transaction: t });
    check('no warehouse → MAIN created', main && main.code === 'MAIN' && main.companyId === companyB && main.isActive === true,
      `code=${main && main.code} active=${main && main.isActive}`);

    // 5) repeat call → no second MAIN
    const r5 = await resolveDefaultWarehouseId(companyB, { transaction: t });
    const mainCount = await Warehouse.count({ where: { companyId: companyB, code: 'MAIN' }, transaction: t });
    check('repeat call → same MAIN, no duplicate', r5 === r4 && mainCount === 1, `r5=${r5} count=${mainCount}`);

    // 6) receipt without warehouseId uses the default warehouse
    const receipt = await receiptService.create(companyB, { items: [] }, t);
    check('receipt without warehouseId → uses default (MAIN)', receipt && receipt.warehouseId === r4,
      `receipt.warehouseId=${receipt && receipt.warehouseId} expected=${r4}`);

    // 7) inventoryService without warehouseId still throws a validation error
    try {
      await inv.applyMove(
        { companyId: companyB, type: 'receipt', toLocationId: crypto.randomUUID(), productId: crypto.randomUUID(), qty: 1 },
        { transaction: t }
      );
      check('inventoryService without warehouseId → throws', false, 'no error thrown');
    } catch (e) {
      const ok = e instanceof AppError && e.statusCode === 400 && e.code === 'VALIDATION_ERROR';
      check('inventoryService without warehouseId → 400 VALIDATION_ERROR', ok,
        `status=${e.statusCode} code=${e.code} msg="${e.message}"`);
    }
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
