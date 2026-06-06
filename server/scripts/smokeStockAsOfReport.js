'use strict';

// Standalone smoke for G2.3 FIFO stock as-of report.
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
//
// Run:
//   docker compose exec backend node scripts/smokeStockAsOfReport.js

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
const stockAsOfReportService = require('../src/services/wms/stockAsOfReportService');

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

function findRow(rows, matcher) {
  return rows.find((row) => Object.entries(matcher).every(([key, value]) => row[key] === value));
}

function totalsMatch(report, qty, stockValue) {
  return round4(report.totals.qty) === qty && round2(report.totals.stockValue) === stockValue;
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
    const company = await Company.create({ name: `Stock AsOf Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouseA = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'ASOF-A', name: 'AsOf WH A', isActive: true },
      { transaction: t }
    );
    const warehouseB = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'ASOF-B', name: 'AsOf WH B', isActive: true },
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
        name: 'AsOf Product',
        slug: `asof-product-${suffix}`,
        sku: 'ASOF-1',
        cost: 20,
        currency: 'PLN',
      },
      { transaction: t }
    );

    const t1 = new Date('2026-01-10T10:00:00.000Z');
    const t2 = new Date('2026-01-11T10:00:00.000Z');
    const t3 = new Date('2026-01-12T10:00:00.000Z');
    const t4 = new Date('2026-01-13T10:00:00.000Z');

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
    check('PZ 10×20 stamped at T1', true);

    const wz = await shipmentService.create(
      companyId,
      { warehouseId: warehouseA.id, items: [{ productId: product.id, qty: 3 }] },
      t
    );
    await shipmentService.shipItem(companyId, wz.items[0].id, { qty: 3, fromLocationId: locationA.id }, t);
    await stampMoves(companyId, { refType: 'WZ', refId: wz.id }, t2, t);
    check('WZ 3 stamped at T2', true);

    const pw = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'PW',
        reason: 'as-of smoke PW',
        items: [{ productId: product.id, locationId: locationA.id, qtyDelta: 5, unitCost: 15, currency: 'PLN' }],
      },
      t
    );
    await adjustmentService.post(companyId, pw.id, t);
    await stampMoves(companyId, { refType: 'PW', refId: pw.id }, t3, t);
    check('PW 5×15 stamped at T3', true);

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
    await stampMoves(companyId, { refType: 'MM', refId: mm.id }, t4, t);
    check('MM 4 stamped at T4', true);

    const common = { groupBy: 'product', currency: 'PLN', productId: product.id };
    const asT1 = await stockAsOfReportService.listStockAsOf(
      companyId,
      { ...common, asOf: t1.toISOString() },
      { transaction: t }
    );
    check(
      'asOf T1: qty 10, value 200',
      asT1.data.length === 1 && totalsMatch(asT1, 10, 200),
      `totals=${JSON.stringify(asT1.totals)}`
    );

    const asT2 = await stockAsOfReportService.listStockAsOf(
      companyId,
      { ...common, asOf: t2.toISOString() },
      { transaction: t }
    );
    check(
      'asOf T2: qty 7, value 140',
      asT2.data.length === 1 && totalsMatch(asT2, 7, 140),
      `totals=${JSON.stringify(asT2.totals)}`
    );

    const asT3 = await stockAsOfReportService.listStockAsOf(
      companyId,
      { ...common, asOf: t3.toISOString() },
      { transaction: t }
    );
    check(
      'asOf T3: qty 12, value 215',
      asT3.data.length === 1 && totalsMatch(asT3, 12, 215),
      `totals=${JSON.stringify(asT3.totals)}`
    );

    const companyAfterMm = await stockAsOfReportService.listStockAsOf(
      companyId,
      { ...common, asOf: t4.toISOString() },
      { transaction: t }
    );
    check(
      'asOf after MM: company qty/value unchanged',
      companyAfterMm.data.length === 1 && totalsMatch(companyAfterMm, 12, 215),
      `totals=${JSON.stringify(companyAfterMm.totals)}`
    );

    const warehouseAfterMm = await stockAsOfReportService.listStockAsOf(
      companyId,
      { groupBy: 'warehouse', asOf: t4.toISOString(), currency: 'PLN' },
      { transaction: t }
    );
    const whA = findRow(warehouseAfterMm.data, { warehouseId: warehouseA.id });
    const whB = findRow(warehouseAfterMm.data, { warehouseId: warehouseB.id });
    check(
      'groupBy warehouse after MM: WH A has qty 8 / value 135',
      whA && round4(whA.qty) === 8 && round2(whA.stockValue) === 135,
      `WH A=${whA ? JSON.stringify(whA) : 'missing'}`
    );
    check(
      'groupBy warehouse after MM: WH B has qty 4 / value 80',
      whB && round4(whB.qty) === 4 && round2(whB.stockValue) === 80,
      `WH B=${whB ? JSON.stringify(whB) : 'missing'}`
    );
    check(
      'groupBy warehouse totals remain qty 12 / value 215',
      totalsMatch(warehouseAfterMm, 12, 215),
      `totals=${JSON.stringify(warehouseAfterMm.totals)}`
    );

    const productWarehouse = await stockAsOfReportService.listStockAsOf(
      companyId,
      { groupBy: 'productWarehouse', asOf: t4.toISOString(), productId: product.id, currency: 'PLN' },
      { transaction: t }
    );
    check(
      'groupBy productWarehouse returns product rows per warehouse',
      productWarehouse.data.length === 2
        && findRow(productWarehouse.data, { warehouseId: warehouseA.id, productId: product.id })
        && findRow(productWarehouse.data, { warehouseId: warehouseB.id, productId: product.id }),
      `rows=${productWarehouse.data.length}`
    );

    const filteredWarehouse = await stockAsOfReportService.listStockAsOf(
      companyId,
      { groupBy: 'warehouse', asOf: t4.toISOString(), warehouseId: warehouseB.id, currency: 'PLN' },
      { transaction: t }
    );
    check(
      'warehouseId filter returns only WH B as-of balance',
      filteredWarehouse.data.length === 1
        && filteredWarehouse.data[0].warehouseId === warehouseB.id
        && totalsMatch(filteredWarehouse, 4, 80),
      `totals=${JSON.stringify(filteredWarehouse.totals)}`
    );

    const beforeMoves = await stockAsOfReportService.listStockAsOf(
      companyId,
      { groupBy: 'product', asOf: '2026-01-01T00:00:00.000Z', currency: 'PLN' },
      { transaction: t }
    );
    check(
      'asOf before first move returns empty totals',
      beforeMoves.data.length === 0 && totalsMatch(beforeMoves, 0, 0),
      `totals=${JSON.stringify(beforeMoves.totals)}`
    );

    await expectValidationError(
      'missing asOf returns VALIDATION_ERROR',
      () => stockAsOfReportService.listStockAsOf(
        companyId,
        { groupBy: 'product' },
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
  console.error('Smoke stock as-of report failed:', error);
  process.exitCode = 1;
});
