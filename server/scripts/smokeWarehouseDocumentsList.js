'use strict';

// Standalone runtime smoke for unified warehouse documents list (WMS-DOCS-2).
// NON-DESTRUCTIVE: all data is created inside a transaction and rolled back at the end.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeWarehouseDocumentsList.js

const crypto = require('crypto');
const {
  sequelize,
  Adjustment,
  AdjustmentItem,
  Company,
  Location,
  Receipt,
  ReceiptItem,
  Shipment,
  ShipmentItem,
  TransferOrder,
  TransferItem,
  Warehouse,
} = require('../src/models');
const warehouseDocumentsService = require('../src/services/wms/warehouseDocumentsService');

const results = [];
function check(name, cond, extra = '') {
  const ok = Boolean(cond);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `WMS Docs List Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;

    const wh1 = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'WDL-1', name: 'Docs List WH 1', isActive: true },
      { transaction: t }
    );
    const wh2 = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'WDL-2', name: 'Docs List WH 2', isActive: true },
      { transaction: t }
    );
    const loc1 = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: wh1.id, code: 'WDL-L1', type: 'bulk' },
      { transaction: t }
    );
    const productId = crypto.randomUUID();

    // --- PZ (receipt) ---
    const pz = await Receipt.create(
      { companyId, warehouseId: wh1.id, number: `PZ/SMK/${suffix}/0001`, status: 'received' },
      { transaction: t }
    );
    await ReceiptItem.create(
      { companyId, receiptId: pz.id, productId, qtyExpected: 10, qtyReceived: 10 },
      { transaction: t }
    );
    await ReceiptItem.create(
      { companyId, receiptId: pz.id, productId, qtyExpected: 5, qtyReceived: 5 },
      { transaction: t }
    );
    const pzk = await Receipt.create(
      {
        companyId,
        warehouseId: wh1.id,
        number: `PZK/SMK/${suffix}/0001`,
        status: 'received',
        parentDocumentId: pz.id,
      },
      { transaction: t }
    );
    await ReceiptItem.create(
      { companyId, receiptId: pzk.id, productId, qtyExpected: 2, qtyReceived: 2 },
      { transaction: t }
    );
    await pz.update({ status: 'corrected', correctedById: pzk.id }, { transaction: t });

    // --- WZ (shipment) ---
    const wz = await Shipment.create(
      { companyId, warehouseId: wh1.id, number: `WZ/SMK/${suffix}/0001`, status: 'shipped' },
      { transaction: t }
    );
    await ShipmentItem.create(
      { companyId, shipmentId: wz.id, productId, qty: 3 },
      { transaction: t }
    );
    const wzk = await Shipment.create(
      {
        companyId,
        warehouseId: wh1.id,
        number: `WZK/SMK/${suffix}/0001`,
        status: 'shipped',
        parentDocumentId: wz.id,
      },
      { transaction: t }
    );
    await ShipmentItem.create(
      { companyId, shipmentId: wzk.id, productId, qty: 1 },
      { transaction: t }
    );
    await wz.update({ status: 'corrected', correctedById: wzk.id }, { transaction: t });

    // --- MM (transfer) ---
    const mm = await TransferOrder.create(
      {
        companyId, fromWarehouseId: wh1.id, toWarehouseId: wh2.id,
        number: `MM/SMK/${suffix}/0001`, status: 'in_transit',
      },
      { transaction: t }
    );
    await TransferItem.create(
      { companyId, transferId: mm.id, productId, qty: 4, movedQty: 0 },
      { transaction: t }
    );

    // --- RW + PW (adjustments) ---
    const rw = await Adjustment.create(
      { companyId, warehouseId: wh1.id, documentType: 'RW', number: `RW/SMK/${suffix}/0001`, status: 'posted', postedAt: new Date() },
      { transaction: t }
    );
    await AdjustmentItem.create(
      { companyId, adjustmentId: rw.id, productId, locationId: loc1.id, qtyDelta: -2, currency: 'PLN' },
      { transaction: t }
    );

    const pw = await Adjustment.create(
      { companyId, warehouseId: wh1.id, documentType: 'PW', number: `PW/SMK/${suffix}/0001`, status: 'posted', postedAt: new Date() },
      { transaction: t }
    );
    await AdjustmentItem.create(
      { companyId, adjustmentId: pw.id, productId, locationId: loc1.id, qtyDelta: 7, unitCost: 5, currency: 'PLN' },
      { transaction: t }
    );

    const passThroughTx = (opts) => ({ ...opts, options: { transaction: t } });

    // ============================================================
    // 1) all → 7 docs, each shape correct
    // ============================================================
    const all = await warehouseDocumentsService.list(passThroughTx({ companyId, query: {} }));
    check('all: returns 7 docs (PZ + PZK + WZ + WZK + MM + RW + PW)',
      all.data.length === 7, `len=${all.data.length}`);
    check('all: pagination.total = 7', all.pagination.total === 7, `total=${all.pagination.total}`);

    const types = new Set(all.data.map((d) => d.type));
    check('all: types include PZ,PZK,WZ,WZK,MM,RW,PW',
      ['PZ', 'PZK', 'WZ', 'WZK', 'MM', 'RW', 'PW'].every((t) => types.has(t)),
      `types=${[...types].sort().join(',')}`);

    const pzRow = all.data.find((d) => d.id === pz.id);
    check('PZ row shape: type/number/status/warehouseId/warehouseCode',
      pzRow && pzRow.type === 'PZ' && pzRow.status === 'corrected'
        && pzRow.warehouseId === wh1.id && pzRow.warehouseCode === 'WDL-1'
        && pzRow.route === `/main/wms/receipts/${pz.id}`,
      `row=${JSON.stringify({type: pzRow && pzRow.type, code: pzRow && pzRow.warehouseCode, route: pzRow && pzRow.route})}`);
    check('PZ row: itemsCount=2, totalQty=15 (10+5)',
      pzRow && pzRow.itemsCount === 2 && pzRow.totalQty === 15,
      `items=${pzRow && pzRow.itemsCount} qty=${pzRow && pzRow.totalQty}`);
    check('PZ original relation: correctedById set, documentRelation=original',
      pzRow && pzRow.correctedById === pzk.id && pzRow.documentRelation === 'original',
      `correctedById=${pzRow && pzRow.correctedById} rel=${pzRow && pzRow.documentRelation}`);

    const pzkRow = all.data.find((d) => d.id === pzk.id);
    check('PZK row: type=PZK, route receipts, parentDocumentId set, relation=correction',
      pzkRow && pzkRow.type === 'PZK'
        && pzkRow.route === `/main/wms/receipts/${pzk.id}`
        && pzkRow.parentDocumentId === pz.id
        && pzkRow.correctedById === null
        && pzkRow.documentRelation === 'correction',
      `row=${JSON.stringify({type: pzkRow && pzkRow.type, parent: pzkRow && pzkRow.parentDocumentId, route: pzkRow && pzkRow.route})}`);

    const mmRow = all.data.find((d) => d.id === mm.id);
    check('MM row shape: type, warehouseId=null, source/targetWarehouseCode set',
      mmRow && mmRow.type === 'MM' && mmRow.warehouseId === null
        && mmRow.sourceWarehouseCode === 'WDL-1' && mmRow.targetWarehouseCode === 'WDL-2'
        && mmRow.route === `/main/wms/transfers/${mm.id}`,
      `src=${mmRow && mmRow.sourceWarehouseCode} tgt=${mmRow && mmRow.targetWarehouseCode}`);
    check('MM row: totalQty=4', mmRow && mmRow.totalQty === 4);

    const rwRow = all.data.find((d) => d.id === rw.id);
    check('RW row: type=RW, totalQty=2 (abs sum)', rwRow && rwRow.type === 'RW' && rwRow.totalQty === 2);
    const pwRow = all.data.find((d) => d.id === pw.id);
    check('PW row: type=PW, totalQty=7', pwRow && pwRow.type === 'PW' && pwRow.totalQty === 7);

    const wzRow = all.data.find((d) => d.id === wz.id);
    check('WZ original relation: correctedById set, documentRelation=original',
      wzRow && wzRow.type === 'WZ' && wzRow.correctedById === wzk.id && wzRow.documentRelation === 'original',
      `correctedById=${wzRow && wzRow.correctedById} rel=${wzRow && wzRow.documentRelation}`);
    const wzkRow = all.data.find((d) => d.id === wzk.id);
    check('WZK row: type=WZK, route shipments, parentDocumentId set, relation=correction',
      wzkRow && wzkRow.type === 'WZK'
        && wzkRow.route === `/main/wms/shipments/${wzk.id}`
        && wzkRow.parentDocumentId === wz.id
        && wzkRow.documentRelation === 'correction',
      `row=${JSON.stringify({type: wzkRow && wzkRow.type, parent: wzkRow && wzkRow.parentDocumentId, route: wzkRow && wzkRow.route})}`);

    // ============================================================
    // 2) type filter
    // ============================================================
    const onlyPzWz = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { type: 'PZ,WZ' } }));
    check('type=PZ,WZ → 2 docs', onlyPzWz.data.length === 2, `len=${onlyPzWz.data.length}`);
    check('type=PZ,WZ → only those types',
      onlyPzWz.data.every((d) => d.type === 'PZ' || d.type === 'WZ'));

    // ============================================================
    const onlyPzk = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { type: 'PZK' } }));
    check('type=PZK → 1 PZK doc',
      onlyPzk.data.length === 1 && onlyPzk.data[0].id === pzk.id && onlyPzk.data[0].parentDocumentId === pz.id,
      `len=${onlyPzk.data.length}`);
    const onlyWzk = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { type: 'WZK' } }));
    check('type=WZK → 1 WZK doc',
      onlyWzk.data.length === 1 && onlyWzk.data[0].id === wzk.id && onlyWzk.data[0].parentDocumentId === wz.id,
      `len=${onlyWzk.data.length}`);

    // ============================================================
    // 3) warehouseId filter — PZ/PZK/WZ/WZK/RW/PW belong to wh1, MM touches both → wh1 returns 7, wh2 returns 1 (MM only)
    // ============================================================
    const wh1Only = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { warehouseId: wh1.id } }));
    check(`warehouseId=wh1 → 7 docs (PZ, PZK, WZ, WZK, MM, RW, PW)`,
      wh1Only.data.length === 7, `len=${wh1Only.data.length}`);
    const wh2Only = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { warehouseId: wh2.id } }));
    check(`warehouseId=wh2 → 1 doc (MM target)`,
      wh2Only.data.length === 1 && wh2Only.data[0].type === 'MM', `len=${wh2Only.data.length}`);

    // ============================================================
    // 4) status filter
    // ============================================================
    const posted = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { status: 'posted' } }));
    check('status=posted → 2 docs (RW + PW)',
      posted.data.length === 2 && posted.data.every((d) => d.status === 'posted'),
      `len=${posted.data.length}`);

    // ============================================================
    // 5) search filter
    // ============================================================
    const byNumber = await warehouseDocumentsService.list(passThroughTx({
      companyId, query: { search: `PZ/SMK/${suffix}` },
    }));
    check('search by PZ number → only PZ doc',
      byNumber.data.length === 1 && byNumber.data[0].type === 'PZ',
      `len=${byNumber.data.length}`);

    // ============================================================
    // 6) date filter — dateFrom set to "now+1 hour" returns nothing
    // ============================================================
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const noneFuture = await warehouseDocumentsService.list(passThroughTx({
      companyId, query: { dateFrom: future },
    }));
    check('dateFrom=future → empty list',
      noneFuture.data.length === 0 && noneFuture.pagination.total === 0,
      `len=${noneFuture.data.length}`);

    // ============================================================
    // 7) pagination (limit=2, pages 1..4)
    // ============================================================
    const p1 = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { limit: 2, page: 1 } }));
    const p2 = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { limit: 2, page: 2 } }));
    const p3 = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { limit: 2, page: 3 } }));
    const p4 = await warehouseDocumentsService.list(passThroughTx({ companyId, query: { limit: 2, page: 4 } }));
    check('pagination page1 limit=2 → 2 items',
      p1.data.length === 2 && p1.pagination.page === 1 && p1.pagination.total === 7);
    check('pagination page2 limit=2 → 2 items',
      p2.data.length === 2 && p2.pagination.page === 2);
    check('pagination page3 limit=2 → 2 items',
      p3.data.length === 2 && p3.pagination.page === 3);
    check('pagination page4 limit=2 → 1 item (7 total)',
      p4.data.length === 1 && p4.pagination.page === 4);
    check('pagination pageCount=4',
      p1.pagination.pageCount === 4, `pc=${p1.pagination.pageCount}`);

    // ============================================================
    // 8) Invalid type → 400
    // ============================================================
    let invalidTypeRejected = false;
    try {
      await warehouseDocumentsService.list(passThroughTx({ companyId, query: { type: 'XYZ' } }));
    } catch (e) {
      invalidTypeRejected = e && e.statusCode === 400 && e.code === 'VALIDATION_ERROR';
    }
    check('type=XYZ → 400 VALIDATION_ERROR', invalidTypeRejected);

    // ============================================================
    // 9) totalCount shape across pagination
    // ============================================================
    check('all pages share total=7 across pages',
      p1.pagination.total === 7 && p2.pagination.total === 7 && p3.pagination.total === 7 && p4.pagination.total === 7);
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

  const failed = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();
