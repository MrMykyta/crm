'use strict';

// Standalone runtime smoke for WMS PZ/MM list/detail/history (A2/A3).
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeWmsDocumentsHistory.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Warehouse,
  Location,
  Product,
  TransferItem,
} = require('../src/models');

const receiptService = require('../src/services/wms/receiptService');
const transferService = require('../src/services/wms/transferService');
const transferOrderService = require('../src/services/wms/transferOrderService');
const stockMoveService = require('../src/services/wms/stockMoveService');

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

    const company = await Company.create({ name: 'A2A3 WMS History Smoke' }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'A2A3-WH',
        name: 'A2A3 Warehouse',
        isActive: true,
      },
      { transaction: t }
    );

    const locA = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'A2A3-A',
        type: 'bulk',
      },
      { transaction: t }
    );

    const locB = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'A2A3-B',
        type: 'bulk',
      },
      { transaction: t }
    );

    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'A2A3 Product',
        slug: `a2a3-product-${Date.now()}`,
        sku: 'A2A3-SKU',
      },
      { transaction: t }
    );

    // ---------------- PZ ----------------
    const receipt = await receiptService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        items: [{ productId: product.id, variantId: null, qtyExpected: 10 }],
      },
      t
    );
    const receiptItem = receipt.items[0];

    await receiptService.receiveLine(
      companyId,
      receiptItem.id,
      {
        qty: 10,
        toLocationId: locA.id,
      },
      t
    );

    const pzList = await receiptService.list(companyId, { page: 1, limit: 20 }, { transaction: t });
    check('PZ list returns created receipt', pzList.rows.some((row) => row.id === receipt.id), `count=${pzList.count}`);

    const pzDetail = await receiptService.getById(companyId, receipt.id, { transaction: t });
    check('PZ detail returns items', pzDetail && Array.isArray(pzDetail.items) && pzDetail.items.length === 1, `items=${pzDetail?.items?.length}`);

    const pzDocHistory = await receiptService.listStockMoves(companyId, receipt.id, { page: 1, limit: 20 }, { transaction: t });
    check('PZ stock_moves by document', pzDocHistory && pzDocHistory.rows.length === 1, `rows=${pzDocHistory?.rows?.length}`);

    const pzItemHistory = await receiptService.listItemStockMoves(companyId, receiptItem.id, { page: 1, limit: 20 }, { transaction: t });
    check('PZ stock_moves by receipt item (refItemId)', pzItemHistory && pzItemHistory.rows.length === 1, `rows=${pzItemHistory?.rows?.length}`);

    // ---------------- MM ----------------
    const transfer = await transferService.create(
      companyId,
      {
        fromWarehouseId: warehouse.id,
        toWarehouseId: warehouse.id,
        items: [{ productId: product.id, variantId: null, qty: 4 }],
      },
      t
    );

    const transferItem = await TransferItem.findOne({ where: { transferId: transfer.id }, transaction: t });

    await transferService.executeLine(
      companyId,
      transferItem.id,
      {
        qty: 4,
        fromLocationId: locA.id,
        toLocationId: locB.id,
      },
      t
    );

    const mmList = await transferOrderService.list({ query: { page: 1, limit: 20 }, user: { companyId }, transaction: t });
    check('MM list returns created transfer', mmList.rows.some((row) => row.id === transfer.id), `count=${mmList.count}`);

    const mmDetail = await transferOrderService.getById(transfer.id, companyId, { transaction: t });
    check('MM detail returns items', mmDetail && Array.isArray(mmDetail.items) && mmDetail.items.length === 1, `items=${mmDetail?.items?.length}`);

    const mmDocHistory = await transferOrderService.listStockMovesByTransfer(transfer.id, companyId, { page: 1, limit: 20 }, { transaction: t });
    check('MM stock_moves by document', mmDocHistory && mmDocHistory.rows.length === 2, `rows=${mmDocHistory?.rows?.length}`);

    const mmItemHistory = await transferOrderService.listStockMovesByTransferItem(transferItem.id, companyId, { page: 1, limit: 20 }, { transaction: t });
    check('MM stock_moves by transfer item (refItemId)', mmItemHistory && mmItemHistory.rows.length === 2, `rows=${mmItemHistory?.rows?.length}`);

    // ---------------- Generic history endpoints logic ----------------
    const genericDocPz = await stockMoveService.listHistoryByDocument({
      companyId,
      refType: 'PZ',
      refId: receipt.id,
      page: 1,
      limit: 20,
      transaction: t,
    });
    check('History by document (PZ)', genericDocPz.rows.length === 1, `rows=${genericDocPz.rows.length}`);

    const genericDocMmByItem = await stockMoveService.listHistoryByDocument({
      companyId,
      refType: 'MM',
      refId: transfer.id,
      refItemId: transferItem.id,
      page: 1,
      limit: 20,
      transaction: t,
    });
    check('History by document + refItemId (MM)', genericDocMmByItem.rows.length === 2, `rows=${genericDocMmByItem.rows.length}`);

    const genericProductAll = await stockMoveService.listHistoryByProduct({
      companyId,
      productId: product.id,
      page: 1,
      limit: 50,
      transaction: t,
    });
    check('History by productId', genericProductAll.rows.length === 3, `rows=${genericProductAll.rows.length}`);

    const genericProductByRefItem = await stockMoveService.listHistoryByProduct({
      companyId,
      productId: product.id,
      refItemId: transferItem.id,
      page: 1,
      limit: 50,
      transaction: t,
    });
    check('History by productId + refItemId', genericProductByRefItem.rows.length === 2, `rows=${genericProductByRefItem.rows.length}`);
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
