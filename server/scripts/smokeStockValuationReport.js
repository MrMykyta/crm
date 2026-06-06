'use strict';

// Standalone smoke for G2 FIFO stock valuation report.
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
//
// Run:
//   docker compose exec backend node scripts/smokeStockValuationReport.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Location,
  Product,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const adjustmentService = require('../src/services/wms/adjustmentService');
const transferService = require('../src/services/wms/transferService');
const stockValuationReportService = require('../src/services/wms/stockValuationReportService');

const results = [];

function n(value) {
  return Number(value);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
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

function findRow(rows, matcher) {
  return rows.find((row) => Object.entries(matcher).every(([key, value]) => row[key] === value));
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `Stock Valuation Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouseA = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'VAL-A', name: 'Valuation WH A', isActive: true },
      { transaction: t }
    );
    const warehouseB = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'VAL-B', name: 'Valuation WH B', isActive: true },
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
        name: 'Valuation Product',
        slug: `valuation-product-${suffix}`,
        sku: 'VAL-1',
        cost: 20,
        currency: 'PLN',
      },
      { transaction: t }
    );

    const pz = await receiptService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        items: [{ productId: product.id, qtyExpected: 10, unitCost: 20, currency: 'PLN' }],
      },
      t
    );
    await receiptService.receiveLine(companyId, pz.items[0].id, { qty: 10, toLocationId: locationA.id }, t);
    check('PZ 10×20 posted into FIFO layer', true);

    const wz = await shipmentService.create(
      companyId,
      { warehouseId: warehouseA.id, items: [{ productId: product.id, qty: 3 }] },
      t
    );
    await shipmentService.shipItem(companyId, wz.items[0].id, { qty: 3, fromLocationId: locationA.id }, t);
    check('WZ 3 consumed FIFO from PZ layer', true);

    const pw = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'PW',
        reason: 'valuation smoke PW',
        items: [{ productId: product.id, locationId: locationA.id, qtyDelta: 5, unitCost: 15, currency: 'PLN' }],
      },
      t
    );
    await adjustmentService.post(companyId, pw.id, t);
    check('PW 5×15 posted into FIFO layer', true);

    const productReportBeforeMm = await stockValuationReportService.listStockValuation(
      companyId,
      { groupBy: 'product', currency: 'PLN' },
      { transaction: t }
    );
    check(
      'groupBy product before MM: qtyRemaining=12 and value=215',
      round4(productReportBeforeMm.totals.qtyRemaining) === 12
        && round2(productReportBeforeMm.totals.stockValue) === 215
        && productReportBeforeMm.data.length === 1,
      `qty=${productReportBeforeMm.totals.qtyRemaining} value=${productReportBeforeMm.totals.stockValue} rows=${productReportBeforeMm.data.length}`
    );

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
    check('MM 4 transferred FIFO layer quantity to another warehouse', true);

    const productReport = await stockValuationReportService.listStockValuation(
      companyId,
      { groupBy: 'product', currency: 'PLN' },
      { transaction: t }
    );
    check(
      'groupBy product after MM: company qty/value unchanged',
      round4(productReport.totals.qtyRemaining) === 12
        && round2(productReport.totals.stockValue) === 215
        && productReport.data.length === 1
        && productReport.data[0].productId === product.id,
      `qty=${productReport.totals.qtyRemaining} value=${productReport.totals.stockValue} rows=${productReport.data.length}`
    );

    const warehouseReport = await stockValuationReportService.listStockValuation(
      companyId,
      { groupBy: 'warehouse', currency: 'PLN' },
      { transaction: t }
    );
    const whA = findRow(warehouseReport.data, { warehouseId: warehouseA.id });
    const whB = findRow(warehouseReport.data, { warehouseId: warehouseB.id });
    check(
      'groupBy warehouse: WH A has 8 qty / 135 value',
      whA && round4(whA.qtyRemaining) === 8 && round2(whA.stockValue) === 135,
      `qty=${whA && whA.qtyRemaining} value=${whA && whA.stockValue}`
    );
    check(
      'groupBy warehouse: WH B has 4 qty / 80 value',
      whB && round4(whB.qtyRemaining) === 4 && round2(whB.stockValue) === 80,
      `qty=${whB && whB.qtyRemaining} value=${whB && whB.stockValue}`
    );
    check(
      'groupBy warehouse totals remain 12 / 215',
      round4(warehouseReport.totals.qtyRemaining) === 12 && round2(warehouseReport.totals.stockValue) === 215,
      `qty=${warehouseReport.totals.qtyRemaining} value=${warehouseReport.totals.stockValue}`
    );

    const productWarehouseReport = await stockValuationReportService.listStockValuation(
      companyId,
      { groupBy: 'productWarehouse', productId: product.id, currency: 'PLN' },
      { transaction: t }
    );
    const pwhA = findRow(productWarehouseReport.data, { warehouseId: warehouseA.id, productId: product.id });
    const pwhB = findRow(productWarehouseReport.data, { warehouseId: warehouseB.id, productId: product.id });
    check(
      'groupBy productWarehouse returns one row per product+warehouse',
      productWarehouseReport.data.length === 2
        && pwhA && round4(pwhA.qtyRemaining) === 8 && round2(pwhA.stockValue) === 135
        && pwhB && round4(pwhB.qtyRemaining) === 4 && round2(pwhB.stockValue) === 80,
      `rows=${productWarehouseReport.data.length}`
    );

    const filteredWarehouseReport = await stockValuationReportService.listStockValuation(
      companyId,
      { groupBy: 'productWarehouse', warehouseId: warehouseB.id, currency: 'PLN' },
      { transaction: t }
    );
    check(
      'warehouseId filter returns only WH B valuation',
      filteredWarehouseReport.data.length === 1
        && filteredWarehouseReport.data[0].warehouseId === warehouseB.id
        && round4(filteredWarehouseReport.totals.qtyRemaining) === 4
        && round2(filteredWarehouseReport.totals.stockValue) === 80,
      `rows=${filteredWarehouseReport.data.length} qty=${filteredWarehouseReport.totals.qtyRemaining}`
    );

    await expectAppError(
      'asOf query returns NOT_IMPLEMENTED',
      'NOT_IMPLEMENTED',
      () => stockValuationReportService.listStockValuation(
        companyId,
        { groupBy: 'product', asOf: '2026-01-01' },
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
  console.error('Smoke stock valuation report failed:', error);
  process.exitCode = 1;
});
