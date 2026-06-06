'use strict';

// K1.8 — correction-aware WMS reports smoke.
// NON-DESTRUCTIVE: all setup runs inside one transaction and is ALWAYS rolled back.
//
// Coverage:
//   A. WZK correction affects ledger/turnover/asOf/valuation for one product.
//   B. PZK correction affects ledger/turnover/asOf/valuation for another product.
//   C. turnover groupBy=documentType includes PZK and WZK buckets.
//   D. asOf at multiple timestamps (pre-/post-correction) returns the correct stock.
//
// Run:
//   docker compose exec backend node scripts/smokeCorrectionAwareReports.js

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
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const inventoryLedgerReportService = require('../src/services/wms/inventoryLedgerReportService');
const stockTurnoverReportService = require('../src/services/wms/stockTurnoverReportService');
const stockAsOfReportService = require('../src/services/wms/stockAsOfReportService');
const stockValuationReportService = require('../src/services/wms/stockValuationReportService');

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

async function stampMovesByCriteria(where, createdAt, transaction) {
  await StockMove.update(
    { createdAt, updatedAt: createdAt },
    { where, transaction }
  );
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `K1.8 Correction Reports ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouse = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'K18-WH', name: 'K1.8 WH', isActive: true },
      { transaction: t }
    );
    const location = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: warehouse.id, code: 'K18-A', type: 'bulk' },
      { transaction: t }
    );

    // Fixed clock so asOf is deterministic across runs.
    const T1 = new Date('2026-03-01T10:00:00.000Z'); // PZ
    const T2 = new Date('2026-03-02T10:00:00.000Z'); // WZ (scenario A) / PZK (scenario B)
    const T3 = new Date('2026-03-03T10:00:00.000Z'); // WZK (scenario A only)

    // ============================================================
    // Scenario A — product A: PZ 10×20 → WZ 4 → WZK 4
    // ============================================================
    const productA = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'K1.8 Product A',
        slug: `k18-a-${suffix}`,
        sku: 'K18-A',
        cost: 20,
        currency: 'PLN',
      },
      { transaction: t }
    );

    const pzA = await receiptService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        items: [{ productId: productA.id, qtyExpected: 10, unitCost: 20, currency: 'PLN' }],
      },
      t
    );
    await receiptService.receiveLine(companyId, pzA.items[0].id, { qty: 10, toLocationId: location.id }, t);
    await stampMovesByCriteria({ companyId, refType: 'PZ', refId: pzA.id }, T1, t);

    const wzA = await shipmentService.create(
      companyId,
      { warehouseId: warehouse.id, items: [{ productId: productA.id, qty: 4 }] },
      t
    );
    await shipmentService.shipItem(companyId, wzA.items[0].id, { qty: 4, fromLocationId: location.id }, t);
    await stampMovesByCriteria({ companyId, refType: 'WZ', refId: wzA.id }, T2, t);

    const wzkA = await shipmentService.createShipmentCorrection(
      companyId,
      wzA.id,
      { items: [{ originalItemId: wzA.items[0].id, qty: 4, locationId: location.id }] },
      { transaction: t }
    );
    await stampMovesByCriteria({ companyId, refType: 'WZ_KOREKTA', refId: wzkA.id }, T3, t);
    check('A setup: PZ + WZ + WZK posted and timestamps stamped', true);

    // ============================================================
    // Scenario B — product B: PZ 5×20 → PZK 5
    // ============================================================
    const productB = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'K1.8 Product B',
        slug: `k18-b-${suffix}`,
        sku: 'K18-B',
        cost: 20,
        currency: 'PLN',
      },
      { transaction: t }
    );

    const pzB = await receiptService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        items: [{ productId: productB.id, qtyExpected: 5, unitCost: 20, currency: 'PLN' }],
      },
      t
    );
    await receiptService.receiveLine(companyId, pzB.items[0].id, { qty: 5, toLocationId: location.id }, t);
    await stampMovesByCriteria({ companyId, refType: 'PZ', refId: pzB.id }, T1, t);

    const pzkB = await receiptService.createReceiptCorrection(
      companyId,
      pzB.id,
      { items: [{ originalItemId: pzB.items[0].id, qty: 5, locationId: location.id }] },
      { transaction: t }
    );
    await stampMovesByCriteria({ companyId, refType: 'PZ_KOREKTA', refId: pzkB.id }, T2, t);
    check('B setup: PZ + PZK posted and timestamps stamped', true);

    // ============================================================
    // Inventory Ledger — product A (PZ 10, WZ 4, WZK 4)
    // ============================================================
    const ledgerA = await inventoryLedgerReportService.listInventoryLedger(
      companyId,
      { productId: productA.id, dateFrom: '2026-02-25', dateTo: '2026-03-10' },
      { transaction: t }
    );
    check('Ledger A: 3 rows (PZ + WZ + WZK)',
      ledgerA.items.length === 3, `n=${ledgerA.items.length}`);
    const rA0 = ledgerA.items[0];
    const rA1 = ledgerA.items[1];
    const rA2 = ledgerA.items[2];
    check('Ledger A row 0: PZ qtyIn=10 balance=10 valueBalance=200',
      rA0.documentType === 'PZ'
        && round4(rA0.qtyIn) === 10
        && round4(rA0.balanceAfter) === 10
        && round2(rA0.valueBalance) === 200,
      `t=${rA0.documentType} qIn=${rA0.qtyIn} bal=${rA0.balanceAfter} v=${rA0.valueBalance}`);
    check('Ledger A row 1: WZ qtyOut=4 balance=6 valueBalance=120',
      rA1.documentType === 'WZ'
        && round4(rA1.qtyOut) === 4
        && round4(rA1.balanceAfter) === 6
        && round2(rA1.valueBalance) === 120,
      `t=${rA1.documentType} qOut=${rA1.qtyOut} bal=${rA1.balanceAfter} v=${rA1.valueBalance}`);
    check('Ledger A row 2: WZK documentType=WZK, qtyIn=4 balance=10 valueBalance=200',
      rA2.documentType === 'WZK'
        && round4(rA2.qtyIn) === 4
        && round4(rA2.balanceAfter) === 10
        && round2(rA2.valueBalance) === 200,
      `t=${rA2.documentType} qIn=${rA2.qtyIn} bal=${rA2.balanceAfter} v=${rA2.valueBalance}`);
    check('Ledger A row 2: documentNumber resolves to WZK/...',
      typeof rA2.documentNumber === 'string' && rA2.documentNumber.startsWith('WZK/'),
      `num=${rA2.documentNumber}`);

    // ============================================================
    // Inventory Ledger — product B (PZ 5, PZK 5)
    // ============================================================
    const ledgerB = await inventoryLedgerReportService.listInventoryLedger(
      companyId,
      { productId: productB.id, dateFrom: '2026-02-25', dateTo: '2026-03-10' },
      { transaction: t }
    );
    check('Ledger B: 2 rows (PZ + PZK)',
      ledgerB.items.length === 2, `n=${ledgerB.items.length}`);
    const rB0 = ledgerB.items[0];
    const rB1 = ledgerB.items[1];
    check('Ledger B row 0: PZ qtyIn=5 balance=5 valueBalance=100',
      rB0.documentType === 'PZ'
        && round4(rB0.qtyIn) === 5
        && round4(rB0.balanceAfter) === 5
        && round2(rB0.valueBalance) === 100,
      `t=${rB0.documentType} qIn=${rB0.qtyIn} bal=${rB0.balanceAfter}`);
    check('Ledger B row 1: PZK documentType=PZK, qtyOut=5 balance=0 valueBalance=0',
      rB1.documentType === 'PZK'
        && round4(rB1.qtyOut) === 5
        && round4(rB1.balanceAfter) === 0
        && round2(rB1.valueBalance) === 0,
      `t=${rB1.documentType} qOut=${rB1.qtyOut} bal=${rB1.balanceAfter} v=${rB1.valueBalance}`);
    check('Ledger B row 1: documentNumber resolves to PZK/...',
      typeof rB1.documentNumber === 'string' && rB1.documentNumber.startsWith('PZK/'),
      `num=${rB1.documentNumber}`);

    // ============================================================
    // Stock Turnover — groupBy=documentType across both products
    // ============================================================
    const turnover = await stockTurnoverReportService.listStockTurnover(
      companyId,
      { dateFrom: '2026-02-25', dateTo: '2026-03-10', groupBy: 'documentType' },
      { transaction: t }
    );
    const buckets = new Map(turnover.data.map((row) => [row.documentType, row]));
    check('Turnover groupBy=documentType includes PZ',
      buckets.has('PZ') && round4(buckets.get('PZ').qtyIn) === 15,
      `pz=${buckets.has('PZ') ? buckets.get('PZ').qtyIn : 'missing'}`);
    check('Turnover groupBy=documentType includes WZ qtyOut=4',
      buckets.has('WZ') && round4(buckets.get('WZ').qtyOut) === 4,
      `wz=${buckets.has('WZ') ? buckets.get('WZ').qtyOut : 'missing'}`);
    check('Turnover groupBy=documentType includes WZK qtyIn=4',
      buckets.has('WZK') && round4(buckets.get('WZK').qtyIn) === 4,
      `wzk=${buckets.has('WZK') ? buckets.get('WZK').qtyIn : 'missing'}`);
    check('Turnover groupBy=documentType includes PZK qtyOut=5',
      buckets.has('PZK') && round4(buckets.get('PZK').qtyOut) === 5,
      `pzk=${buckets.has('PZK') ? buckets.get('PZK').qtyOut : 'missing'}`);
    check('Turnover totals: netQty = 10 (PZ 15 + WZK 4 − WZ 4 − PZK 5)',
      round4(turnover.totals.netQty) === 10,
      `net=${turnover.totals.netQty}`);

    // Per-product netQty: A → 10, B → 0.
    const turnoverProduct = await stockTurnoverReportService.listStockTurnover(
      companyId,
      { dateFrom: '2026-02-25', dateTo: '2026-03-10', groupBy: 'product' },
      { transaction: t }
    );
    const byProduct = new Map(turnoverProduct.data.map((row) => [row.productId, row]));
    check('Turnover groupBy=product: A netQty=10 (PZ 10 + WZK 4 − WZ 4)',
      byProduct.has(productA.id) && round4(byProduct.get(productA.id).netQty) === 10,
      `A=${byProduct.has(productA.id) ? byProduct.get(productA.id).netQty : 'missing'}`);
    check('Turnover groupBy=product: B netQty=0 (PZ 5 − PZK 5)',
      byProduct.has(productB.id) && round4(byProduct.get(productB.id).netQty) === 0,
      `B=${byProduct.has(productB.id) ? byProduct.get(productB.id).netQty : 'missing'}`);

    // ============================================================
    // Stock As Of — A: T2 → 6, T3 → 10; B: T1 → 5, T2 → 0
    // ============================================================
    // asOf accepts date-only strings (inclusive end-of-day) or full ISO. To peek pre-T2/T3
    // we use timestamps slightly before/after the move's createdAt.
    const asOfPreT2 = await stockAsOfReportService.listStockAsOf(
      companyId,
      { asOf: '2026-03-01T23:59:59.999Z', productId: productA.id, groupBy: 'product' },
      { transaction: t }
    );
    check('AsOf A @ 2026-03-01 23:59:59 (after PZ, before WZ): qty=10',
      round4(asOfPreT2.totals.qty) === 10, `qty=${asOfPreT2.totals.qty}`);

    const asOfAfterT2 = await stockAsOfReportService.listStockAsOf(
      companyId,
      { asOf: '2026-03-02T23:59:59.999Z', productId: productA.id, groupBy: 'product' },
      { transaction: t }
    );
    check('AsOf A @ 2026-03-02 23:59:59 (after WZ, before WZK): qty=6',
      round4(asOfAfterT2.totals.qty) === 6, `qty=${asOfAfterT2.totals.qty}`);

    const asOfAfterT3 = await stockAsOfReportService.listStockAsOf(
      companyId,
      { asOf: '2026-03-03T23:59:59.999Z', productId: productA.id, groupBy: 'product' },
      { transaction: t }
    );
    check('AsOf A @ 2026-03-03 23:59:59 (after WZK): qty=10 (restored)',
      round4(asOfAfterT3.totals.qty) === 10, `qty=${asOfAfterT3.totals.qty}`);
    check('AsOf A @ T3 stockValue=200 (10 × 20)',
      round2(asOfAfterT3.totals.stockValue) === 200, `v=${asOfAfterT3.totals.stockValue}`);

    const asOfBPreT2 = await stockAsOfReportService.listStockAsOf(
      companyId,
      { asOf: '2026-03-01T23:59:59.999Z', productId: productB.id, groupBy: 'product' },
      { transaction: t }
    );
    check('AsOf B @ T1 (before PZK): qty=5',
      round4(asOfBPreT2.totals.qty) === 5, `qty=${asOfBPreT2.totals.qty}`);

    const asOfBAfterT2 = await stockAsOfReportService.listStockAsOf(
      companyId,
      { asOf: '2026-03-02T23:59:59.999Z', productId: productB.id, groupBy: 'product' },
      { transaction: t }
    );
    check('AsOf B @ T2 (after PZK): qty=0',
      round4(asOfBAfterT2.totals.qty) === 0,
      `qty=${asOfBAfterT2.totals.qty} (empty data=${asOfBAfterT2.data.length})`);

    // ============================================================
    // Stock Valuation — layer-based; A restored, B zeroed
    // ============================================================
    const valA = await stockValuationReportService.listStockValuation(
      companyId,
      { productId: productA.id, groupBy: 'product' },
      { transaction: t }
    );
    check('Valuation A: qtyRemaining=10 (WZK restored layer), stockValue=200',
      round4(valA.totals.qtyRemaining) === 10 && round2(valA.totals.stockValue) === 200,
      `qty=${valA.totals.qtyRemaining} v=${valA.totals.stockValue}`);

    const valB = await stockValuationReportService.listStockValuation(
      companyId,
      { productId: productB.id, groupBy: 'product' },
      { transaction: t }
    );
    check('Valuation B: qtyRemaining=0 (PZK exhausted layer), stockValue=0',
      round4(valB.totals.qtyRemaining) === 0 && round2(valB.totals.stockValue) === 0,
      `qty=${valB.totals.qtyRemaining} v=${valB.totals.stockValue} rows=${valB.data.length}`);
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
