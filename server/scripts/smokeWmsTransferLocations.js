'use strict';

// MM-EXECUTE-1 smoke — TransferOrder document-level source/target locations.
//
// NON-DESTRUCTIVE: everything runs inside a single outer transaction that is always
// rolled back.
//
// Scenarios:
//   A. create transfer with source/target locations → persisted; getById DTO includes
//      sourceLocation/targetLocation summaries + ids.
//   B. executeLine WITHOUT explicit payload locations → falls back to document-level
//      locations; draft -> in_transit on partial execute; moves carry doc locations.
//   C. executeLine remaining qty → in_transit -> received when all lines moved.
//   D. execute a transfer with no doc-level locations and no payload locations
//      → 400 TRANSFER_LOCATION_REQUIRED.
//   E. create validation: location not in company → TRANSFER_LOCATION_INVALID;
//      location belongs to wrong warehouse → TRANSFER_LOCATION_WAREHOUSE_MISMATCH.

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Location,
  Product,
  StockMove,
  TransferItem,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const receiptService = require('../src/services/wms/receiptService');
const transferService = require('../src/services/wms/transferService');
const transferOrderService = require('../src/services/wms/transferOrderService');

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
      error instanceof AppError && error.code === expectedCode,
      `status=${error.statusCode} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();

    // Setup: company (FIFO-initialized), source warehouse + location, target warehouse + location.
    const company = await Company.create({ name: `MM Locations Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );
    const whFrom = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'MM-WH-FROM', name: 'From WH', isActive: true },
      { transaction: t }
    );
    const whTo = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'MM-WH-TO', name: 'To WH', isActive: true },
      { transaction: t }
    );
    const srcLoc = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: whFrom.id, code: 'LOC-SRC', type: 'bulk' },
      { transaction: t }
    );
    const tgtLoc = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: whTo.id, code: 'LOC-TGT', type: 'bulk' },
      { transaction: t }
    );
    const product = await Product.create(
      { id: crypto.randomUUID(), companyId, name: 'MM Product', slug: `mm-loc-${suffix}`, sku: 'MM-LOC-1', cost: 20 },
      { transaction: t }
    );

    // Seed on-hand 10 @ srcLoc (PZ receive) so the transfer can be executed (FIFO consume).
    const pz = await receiptService.create(
      companyId,
      { warehouseId: whFrom.id, items: [{ productId: product.id, qtyExpected: 10, unitCost: 20, currency: 'PLN' }] },
      t
    );
    await receiptService.receiveLine(companyId, pz.items[0].id, { qty: 10, toLocationId: srcLoc.id }, t);

    // ---- Scenario A: create with doc-level locations + DTO enrichment ----
    const mm = await transferService.create(
      companyId,
      {
        fromWarehouseId: whFrom.id,
        toWarehouseId: whTo.id,
        sourceLocationId: srcLoc.id,
        targetLocationId: tgtLoc.id,
        items: [{ productId: product.id, qty: 10 }],
      },
      t
    );
    check('A: transfer persisted sourceLocationId', mm.sourceLocationId === srcLoc.id, `got=${mm.sourceLocationId}`);
    check('A: transfer persisted targetLocationId', mm.targetLocationId === tgtLoc.id, `got=${mm.targetLocationId}`);

    const dtoA = await transferOrderService.getById(mm.id, companyId, { transaction: t });
    check('A: DTO sourceLocation summary present (id+code)',
      dtoA?.sourceLocation?.id === srcLoc.id && dtoA?.sourceLocation?.code === 'LOC-SRC',
      `src=${JSON.stringify(dtoA?.sourceLocation)}`);
    check('A: DTO targetLocation summary present (id+code)',
      dtoA?.targetLocation?.id === tgtLoc.id && dtoA?.targetLocation?.code === 'LOC-TGT',
      `tgt=${JSON.stringify(dtoA?.targetLocation)}`);
    check('A: DTO sourceLocationId/targetLocationId ids',
      dtoA?.sourceLocationId === srcLoc.id && dtoA?.targetLocationId === tgtLoc.id);

    const mmItems = await TransferItem.findAll({ where: { transferId: mm.id }, transaction: t });
    const mmItemId = mmItems[0].id;

    // ---- Scenario B: executeLine WITHOUT payload locations (qty 4) → uses doc-level ----
    await transferService.executeLine(companyId, mmItemId, { qty: 4 }, t);
    const itemAfterB = await TransferItem.findByPk(mmItemId, { transaction: t });
    check('B: item movedQty=4 after partial execute', n(itemAfterB.movedQty) === 4, `moved=${itemAfterB.movedQty}`);

    const outMoveB = await StockMove.findOne({
      where: { companyId, refType: 'MM', refId: mm.id, refItemId: mmItemId, fromLocationId: srcLoc.id, type: 'transfer' },
      transaction: t,
    });
    const inMoveB = await StockMove.findOne({
      where: { companyId, refType: 'MM', refId: mm.id, refItemId: mmItemId, toLocationId: tgtLoc.id, type: 'transfer' },
      transaction: t,
    });
    check('B: out move used document sourceLocation', Boolean(outMoveB), `from=${outMoveB?.fromLocationId}`);
    check('B: in move used document targetLocation', Boolean(inMoveB), `to=${inMoveB?.toLocationId}`);

    const mmAfterB = await transferOrderService.getById(mm.id, companyId, { transaction: t });
    check('B: status draft -> in_transit on partial execute', mmAfterB.status === 'in_transit', `status=${mmAfterB.status}`);

    // ---- Scenario C: execute remaining qty 6 (no payload locations) → received ----
    await transferService.executeLine(companyId, mmItemId, { qty: 6 }, t);
    const itemAfterC = await TransferItem.findByPk(mmItemId, { transaction: t });
    check('C: item movedQty=10 after full execute', n(itemAfterC.movedQty) === 10, `moved=${itemAfterC.movedQty}`);
    const mmAfterC = await transferOrderService.getById(mm.id, companyId, { transaction: t });
    check('C: status in_transit -> received when all moved', mmAfterC.status === 'received', `status=${mmAfterC.status}`);

    // ---- Scenario D: transfer with no doc-level locations + no payload → TRANSFER_LOCATION_REQUIRED ----
    const mmNoLoc = await transferService.create(
      companyId,
      { fromWarehouseId: whFrom.id, toWarehouseId: whTo.id, items: [{ productId: product.id, qty: 1 }] },
      t
    );
    const mmNoLocItem = (await TransferItem.findAll({ where: { transferId: mmNoLoc.id }, transaction: t }))[0];
    await expectAppError('D: execute without any locations → TRANSFER_LOCATION_REQUIRED', 'TRANSFER_LOCATION_REQUIRED',
      () => transferService.executeLine(companyId, mmNoLocItem.id, { qty: 1 }, t));

    // ---- Scenario E: create-time location validation ----
    await expectAppError('E: source location not in company → TRANSFER_LOCATION_INVALID', 'TRANSFER_LOCATION_INVALID',
      () => transferService.create(
        companyId,
        { fromWarehouseId: whFrom.id, toWarehouseId: whTo.id, sourceLocationId: crypto.randomUUID(), items: [{ productId: product.id, qty: 1 }] },
        t
      ));
    await expectAppError('E: source location in wrong warehouse → TRANSFER_LOCATION_WAREHOUSE_MISMATCH', 'TRANSFER_LOCATION_WAREHOUSE_MISMATCH',
      () => transferService.create(
        companyId,
        // tgtLoc belongs to whTo, but passed as sourceLocation for fromWarehouse=whFrom
        { fromWarehouseId: whFrom.id, toWarehouseId: whTo.id, sourceLocationId: tgtLoc.id, items: [{ productId: product.id, qty: 1 }] },
        t
      ));

    throw new Error('__ROLLBACK__');
  } catch (error) {
    if (error.message !== '__ROLLBACK__') {
      // eslint-disable-next-line no-console
      console.error('Smoke crashed:', error);
      results.push({ name: 'harness', ok: false });
    }
  } finally {
    if (t) {
      await t.rollback();
      // eslint-disable-next-line no-console
      console.log('-- transaction rolled back (zero pollution expected) --');
    }
    const failed = results.filter((r) => !r.ok);
    // eslint-disable-next-line no-console
    console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
    await sequelize.close().catch(() => {});
    process.exit(failed.length ? 1 : 0);
  }
})();
