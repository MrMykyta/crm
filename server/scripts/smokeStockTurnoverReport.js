'use strict';

// Standalone smoke for G2.2 FIFO stock turnover report.
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
//
// Run:
//   docker compose exec backend node scripts/smokeStockTurnoverReport.js

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
const stockTurnoverReportService = require('../src/services/wms/stockTurnoverReportService');

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

function valuesMatch(row, expected) {
  return row
    && round4(row.qtyIn) === expected.qtyIn
    && round4(row.qtyOut) === expected.qtyOut
    && round2(row.valueIn) === expected.valueIn
    && round2(row.valueOut) === expected.valueOut
    && round4(row.netQty) === expected.netQty
    && round2(row.netValue) === expected.netValue;
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `Stock Turnover Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouseA = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'TURN-A', name: 'Turnover WH A', isActive: true },
      { transaction: t }
    );
    const warehouseB = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'TURN-B', name: 'Turnover WH B', isActive: true },
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
        name: 'Turnover Product',
        slug: `turnover-product-${suffix}`,
        sku: 'TURN-1',
        cost: 20,
        currency: 'PLN',
      },
      { transaction: t }
    );

    const dateFrom = new Date(Date.now() - 60 * 1000).toISOString();

    const pz = await receiptService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        items: [{ productId: product.id, qtyExpected: 10, unitCost: 20, currency: 'PLN' }],
      },
      t
    );
    await receiptService.receiveLine(companyId, pz.items[0].id, { qty: 10, toLocationId: locationA.id }, t);
    check('PZ 10×20 posted', true);

    const wz = await shipmentService.create(
      companyId,
      { warehouseId: warehouseA.id, items: [{ productId: product.id, qty: 3 }] },
      t
    );
    await shipmentService.shipItem(companyId, wz.items[0].id, { qty: 3, fromLocationId: locationA.id }, t);
    check('WZ 3 posted', true);

    const pw = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'PW',
        reason: 'turnover smoke PW',
        items: [{ productId: product.id, locationId: locationA.id, qtyDelta: 5, unitCost: 15, currency: 'PLN' }],
      },
      t
    );
    await adjustmentService.post(companyId, pw.id, t);
    check('PW 5×15 posted', true);

    const rw = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'RW',
        reason: 'turnover smoke RW',
        items: [{ productId: product.id, locationId: locationA.id, qtyDelta: -2 }],
      },
      t
    );
    await adjustmentService.post(companyId, rw.id, t);
    check('RW 2 posted', true);

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
    check('MM 4 posted A -> B', true);

    const dateTo = new Date(Date.now() + 60 * 1000).toISOString();
    const commonQuery = { dateFrom, dateTo, currency: 'PLN' };

    const productReport = await stockTurnoverReportService.listStockTurnover(
      companyId,
      { ...commonQuery, groupBy: 'product' },
      { transaction: t }
    );
    check(
      'groupBy product: company net value reflects PZ/WZ/PW/RW/MM',
      productReport.data.length === 1
        && productReport.data[0].productId === product.id
        && valuesMatch(productReport.data[0], {
          qtyIn: 19,
          qtyOut: 9,
          valueIn: 355,
          valueOut: 180,
          netQty: 10,
          netValue: 175,
        })
        && round4(productReport.totals.netQty) === 10
        && round2(productReport.totals.netValue) === 175,
      `rows=${productReport.data.length} totals=${JSON.stringify(productReport.totals)}`
    );

    const warehouseReport = await stockTurnoverReportService.listStockTurnover(
      companyId,
      { ...commonQuery, groupBy: 'warehouse' },
      { transaction: t }
    );
    const whA = findRow(warehouseReport.data, { warehouseId: warehouseA.id });
    const whB = findRow(warehouseReport.data, { warehouseId: warehouseB.id });
    check(
      'groupBy warehouse: WH A shows PZ/WZ/PW/RW/MM-out',
      valuesMatch(whA, {
        qtyIn: 15,
        qtyOut: 9,
        valueIn: 275,
        valueOut: 180,
        netQty: 6,
        netValue: 95,
      }),
      `WH A=${whA ? JSON.stringify(whA) : 'missing'}`
    );
    check(
      'groupBy warehouse: WH B shows MM-in',
      valuesMatch(whB, {
        qtyIn: 4,
        qtyOut: 0,
        valueIn: 80,
        valueOut: 0,
        netQty: 4,
        netValue: 80,
      }),
      `WH B=${whB ? JSON.stringify(whB) : 'missing'}`
    );
    check(
      'groupBy warehouse totals equal company net value',
      round4(warehouseReport.totals.netQty) === 10 && round2(warehouseReport.totals.netValue) === 175,
      JSON.stringify(warehouseReport.totals)
    );

    const productWarehouseReport = await stockTurnoverReportService.listStockTurnover(
      companyId,
      { ...commonQuery, groupBy: 'productWarehouse', productId: product.id },
      { transaction: t }
    );
    check(
      'groupBy productWarehouse returns rows per product+warehouse',
      productWarehouseReport.data.length === 2
        && findRow(productWarehouseReport.data, { warehouseId: warehouseA.id, productId: product.id })
        && findRow(productWarehouseReport.data, { warehouseId: warehouseB.id, productId: product.id }),
      `rows=${productWarehouseReport.data.length}`
    );

    const documentReport = await stockTurnoverReportService.listStockTurnover(
      companyId,
      { ...commonQuery, groupBy: 'documentType' },
      { transaction: t }
    );
    const pzRow = findRow(documentReport.data, { documentType: 'PZ' });
    const wzRow = findRow(documentReport.data, { documentType: 'WZ' });
    const pwRow = findRow(documentReport.data, { documentType: 'PW' });
    const rwRow = findRow(documentReport.data, { documentType: 'RW' });
    const mmRow = findRow(documentReport.data, { documentType: 'MM' });
    check(
      'groupBy documentType classifies PZ/WZ/PW/RW/MM correctly',
      valuesMatch(pzRow, { qtyIn: 10, qtyOut: 0, valueIn: 200, valueOut: 0, netQty: 10, netValue: 200 })
        && valuesMatch(wzRow, { qtyIn: 0, qtyOut: 3, valueIn: 0, valueOut: 60, netQty: -3, netValue: -60 })
        && valuesMatch(pwRow, { qtyIn: 5, qtyOut: 0, valueIn: 75, valueOut: 0, netQty: 5, netValue: 75 })
        && valuesMatch(rwRow, { qtyIn: 0, qtyOut: 2, valueIn: 0, valueOut: 40, netQty: -2, netValue: -40 })
        && valuesMatch(mmRow, { qtyIn: 4, qtyOut: 4, valueIn: 80, valueOut: 80, netQty: 0, netValue: 0 }),
      `rows=${documentReport.data.map((row) => row.documentType).join(',')}`
    );

    const filteredWarehouseReport = await stockTurnoverReportService.listStockTurnover(
      companyId,
      { ...commonQuery, groupBy: 'warehouse', warehouseId: warehouseB.id },
      { transaction: t }
    );
    check(
      'warehouseId filter returns only WH B turnover',
      filteredWarehouseReport.data.length === 1
        && filteredWarehouseReport.data[0].warehouseId === warehouseB.id
        && round4(filteredWarehouseReport.totals.netQty) === 4
        && round2(filteredWarehouseReport.totals.netValue) === 80,
      `rows=${filteredWarehouseReport.data.length} totals=${JSON.stringify(filteredWarehouseReport.totals)}`
    );

    const emptyRangeReport = await stockTurnoverReportService.listStockTurnover(
      companyId,
      { groupBy: 'product', dateFrom: '2000-01-01', dateTo: '2000-01-02', currency: 'PLN' },
      { transaction: t }
    );
    check(
      'date range outside moves returns empty totals',
      emptyRangeReport.data.length === 0
        && round4(emptyRangeReport.totals.qtyIn) === 0
        && round4(emptyRangeReport.totals.qtyOut) === 0
        && round2(emptyRangeReport.totals.netValue) === 0,
      JSON.stringify(emptyRangeReport.totals)
    );

    await expectValidationError(
      'missing dateFrom returns VALIDATION_ERROR',
      () => stockTurnoverReportService.listStockTurnover(
        companyId,
        { groupBy: 'product', dateTo },
        { transaction: t }
      )
    );
    await expectValidationError(
      'missing dateTo returns VALIDATION_ERROR',
      () => stockTurnoverReportService.listStockTurnover(
        companyId,
        { groupBy: 'product', dateFrom },
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
  console.error('Smoke stock turnover report failed:', error);
  process.exitCode = 1;
});
