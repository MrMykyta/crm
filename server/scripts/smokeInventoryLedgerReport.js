'use strict';

// Standalone smoke for G2.4 inventory ledger / Karta magazynowa report.
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
//
// Run:
//   docker compose exec backend node scripts/smokeInventoryLedgerReport.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Location,
  Product,
  StockMove,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const adjustmentService = require('../src/services/wms/adjustmentService');
const transferService = require('../src/services/wms/transferService');
const inventoryLedgerReportService = require('../src/services/wms/inventoryLedgerReportService');

const results = [];

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function expectValidationError(name, fn) {
  try {
    await fn();
    check(name, false, 'no error thrown');
  } catch (error) {
    check(
      name,
      error instanceof AppError && error.statusCode === 400 && error.code === 'VALIDATION_ERROR',
      `status=${error.statusCode} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

function rowMatches(row, expected) {
  return row
    && row.documentType === expected.documentType
    && round4(row.qtyIn) === expected.qtyIn
    && round4(row.qtyOut) === expected.qtyOut
    && round4(row.balanceAfter) === expected.balanceAfter
    && round2(row.valueIn) === expected.valueIn
    && round2(row.valueOut) === expected.valueOut
    && round2(row.valueBalance) === expected.valueBalance;
}

async function stampMoves(companyId, where, createdAt, transaction) {
  await StockMove.update(
    { createdAt, updatedAt: createdAt },
    { where: { companyId, ...where }, transaction }
  );
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `Inventory Ledger Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouseA = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'LED-A', name: 'Ledger WH A', isActive: true },
      { transaction: t }
    );
    const warehouseB = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'LED-B', name: 'Ledger WH B', isActive: true },
      { transaction: t }
    );
    const locationA = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: warehouseA.id, code: 'A-01', type: 'bulk' },
      { transaction: t }
    );
    const locationB = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: warehouseB.id, code: 'B-01', type: 'bulk' },
      { transaction: t }
    );
    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'Ledger Product',
        slug: `ledger-product-${suffix}`,
        sku: 'LED-1',
        cost: 20,
        currency: 'PLN',
      },
      { transaction: t }
    );

    const t1 = new Date('2026-02-10T10:00:00.000Z');
    const t2 = new Date('2026-02-11T10:00:00.000Z');
    const t3 = new Date('2026-02-12T10:00:00.000Z');
    const t4 = new Date('2026-02-13T10:00:00.000Z');
    const t5 = new Date('2026-02-14T10:00:00.000Z');

    const pz = await receiptService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        items: [{ productId: product.id, qtyExpected: 10, unitCost: 20, currency: 'PLN' }],
      },
      t
    );
    await receiptService.receiveLine(companyId, pz.items[0].id, { qty: 10, toLocationId: locationA.id }, t);
    await stampMoves(companyId, { refType: 'PZ', refId: pz.id }, t1, t);
    check('PZ 10×20 stamped', true);

    const wz = await shipmentService.create(
      companyId,
      { warehouseId: warehouseA.id, items: [{ productId: product.id, qty: 3 }] },
      t
    );
    await shipmentService.shipItem(companyId, wz.items[0].id, { qty: 3, fromLocationId: locationA.id }, t);
    await stampMoves(companyId, { refType: 'WZ', refId: wz.id }, t2, t);
    check('WZ 3 stamped', true);

    const pw = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'PW',
        reason: 'ledger smoke PW',
        items: [{ productId: product.id, locationId: locationA.id, qtyDelta: 5, unitCost: 15, currency: 'PLN' }],
      },
      t
    );
    await adjustmentService.post(companyId, pw.id, t);
    await stampMoves(companyId, { refType: 'PW', refId: pw.id }, t3, t);
    check('PW 5×15 stamped', true);

    const rw = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'RW',
        reason: 'ledger smoke RW',
        items: [{ productId: product.id, locationId: locationA.id, qtyDelta: -2 }],
      },
      t
    );
    await adjustmentService.post(companyId, rw.id, t);
    await stampMoves(companyId, { refType: 'RW', refId: rw.id }, t4, t);
    check('RW 2 stamped', true);

    const mm = await transferService.create(
      companyId,
      {
        fromWarehouseId: warehouseA.id,
        toWarehouseId: warehouseB.id,
        items: [{ productId: product.id, qty: 4 }],
      },
      t
    );
    const mmItems = await sequelize.query(
      'SELECT id FROM transfer_items WHERE transfer_id = :transferId',
      {
        replacements: { transferId: mm.id },
        transaction: t,
        type: sequelize.QueryTypes.SELECT,
      }
    );
    await transferService.executeLine(
      companyId,
      mmItems[0].id,
      { fromLocationId: locationA.id, toLocationId: locationB.id, qty: 4 },
      t
    );

    const mmOut = await StockMove.findOne({
      where: { companyId, refType: 'MM', refId: mm.id, fromLocationId: locationA.id },
      transaction: t,
    });
    const mmIn = await StockMove.findOne({
      where: { companyId, refType: 'MM', refId: mm.id, toLocationId: locationB.id },
      transaction: t,
    });
    await StockMove.update(
      { createdAt: t5, updatedAt: t5 },
      { where: { id: mmOut.id }, transaction: t }
    );
    await StockMove.update(
      { createdAt: new Date(t5.getTime() + 1), updatedAt: new Date(t5.getTime() + 1) },
      { where: { id: mmIn.id }, transaction: t }
    );
    check('MM 4 stamped as out then in', true);

    const ledger = await inventoryLedgerReportService.listInventoryLedger(
      companyId,
      {
        productId: product.id,
        dateFrom: '2026-02-01',
        dateTo: '2026-02-20',
        currency: 'PLN',
      },
      { transaction: t }
    );

    check('ledger returns 6 rows', ledger.items.length === 6, `rows=${ledger.items.length}`);
    check(
      'row 1 PZ balance 10 / 200',
      rowMatches(ledger.items[0], {
        documentType: 'PZ', qtyIn: 10, qtyOut: 0, balanceAfter: 10, valueIn: 200, valueOut: 0, valueBalance: 200,
      }),
      JSON.stringify(ledger.items[0])
    );
    check(
      'row 2 WZ balance 7 / 140',
      rowMatches(ledger.items[1], {
        documentType: 'WZ', qtyIn: 0, qtyOut: 3, balanceAfter: 7, valueIn: 0, valueOut: 60, valueBalance: 140,
      }),
      JSON.stringify(ledger.items[1])
    );
    check(
      'row 3 PW balance 12 / 215',
      rowMatches(ledger.items[2], {
        documentType: 'PW', qtyIn: 5, qtyOut: 0, balanceAfter: 12, valueIn: 75, valueOut: 0, valueBalance: 215,
      }),
      JSON.stringify(ledger.items[2])
    );
    check(
      'row 4 RW balance 10 / 175',
      rowMatches(ledger.items[3], {
        documentType: 'RW', qtyIn: 0, qtyOut: 2, balanceAfter: 10, valueIn: 0, valueOut: 40, valueBalance: 175,
      }),
      JSON.stringify(ledger.items[3])
    );
    check(
      'row 5 MM out balance 6 / 95',
      rowMatches(ledger.items[4], {
        documentType: 'MM', qtyIn: 0, qtyOut: 4, balanceAfter: 6, valueIn: 0, valueOut: 80, valueBalance: 95,
      }) && ledger.items[4].warehouseId === warehouseA.id,
      JSON.stringify(ledger.items[4])
    );
    check(
      'row 6 MM in balance 10 / 175',
      rowMatches(ledger.items[5], {
        documentType: 'MM', qtyIn: 4, qtyOut: 0, balanceAfter: 10, valueIn: 80, valueOut: 0, valueBalance: 175,
      }) && ledger.items[5].warehouseId === warehouseB.id,
      JSON.stringify(ledger.items[5])
    );
    check(
      'ledger totals match final balance',
      round4(ledger.totals.qtyIn) === 19
        && round4(ledger.totals.qtyOut) === 9
        && round2(ledger.totals.valueIn) === 355
        && round2(ledger.totals.valueOut) === 180
        && round4(ledger.totals.balanceAfter) === 10
        && round2(ledger.totals.valueBalance) === 175,
      JSON.stringify(ledger.totals)
    );
    check(
      'documentNumber is resolved for each WMS document',
      ledger.items.every((row) => row.documentNumber),
      ledger.items.map((row) => `${row.documentType}:${row.documentNumber}`).join(',')
    );
    check(
      'location is resolved for each ledger row',
      ledger.items.every((row) => row.locationId && row.locationCode),
      ledger.items.map((row) => `${row.documentType}:${row.locationCode}`).join(',')
    );

    const whB = await inventoryLedgerReportService.listInventoryLedger(
      companyId,
      {
        productId: product.id,
        warehouseId: warehouseB.id,
        dateFrom: '2026-02-01',
        dateTo: '2026-02-20',
        currency: 'PLN',
      },
      { transaction: t }
    );
    check(
      'warehouseId filter returns only WH B MM-in row',
      whB.items.length === 1
        && whB.items[0].documentType === 'MM'
        && round4(whB.items[0].qtyIn) === 4
        && round4(whB.items[0].balanceAfter) === 4
        && round2(whB.items[0].valueBalance) === 80,
      `rows=${whB.items.length} row=${JSON.stringify(whB.items[0])}`
    );

    const empty = await inventoryLedgerReportService.listInventoryLedger(
      companyId,
      {
        productId: product.id,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-02',
        currency: 'PLN',
      },
      { transaction: t }
    );
    check('date range outside moves returns empty ledger', empty.items.length === 0 && empty.totals.balanceAfter === 0);

    await expectValidationError(
      'missing productId returns VALIDATION_ERROR',
      () => inventoryLedgerReportService.listInventoryLedger(
        companyId,
        { dateFrom: '2026-02-01', dateTo: '2026-02-20' },
        { transaction: t }
      )
    );
    await expectValidationError(
      'missing dateFrom returns VALIDATION_ERROR',
      () => inventoryLedgerReportService.listInventoryLedger(
        companyId,
        { productId: product.id, dateTo: '2026-02-20' },
        { transaction: t }
      )
    );
    await expectValidationError(
      'missing dateTo returns VALIDATION_ERROR',
      () => inventoryLedgerReportService.listInventoryLedger(
        companyId,
        { productId: product.id, dateFrom: '2026-02-01' },
        { transaction: t }
      )
    );
  } finally {
    if (t) {
      await t.rollback();
      // eslint-disable-next-line no-console
      console.log('-- transaction rolled back (zero pollution expected) --');
    }
    const failed = results.filter((row) => !row.ok);
    // eslint-disable-next-line no-console
    console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
    if (failed.length) {
      failed.forEach((row) => {
        // eslint-disable-next-line no-console
        console.error(`FAILED: ${row.name}`);
      });
      process.exitCode = 1;
    }
    await sequelize.close();
  }
})().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Smoke inventory ledger report failed:', error);
  process.exitCode = 1;
});
