'use strict';

// Standalone runtime smoke for WMS PZ/MM idempotency guards (T1.2a).
//
// NON-DESTRUCTIVE: all operations run inside a single transaction and are ALWAYS rolled back.
//
// Run inside backend container:
//   docker exec crm_backend node scripts/smokePostingIdempotency.js

const crypto = require('crypto');
const { sequelize, Company, Warehouse, Location, StockMove, TransferItem } = require('../src/models');
const AppError = require('../src/errors/AppError');
const inventoryService = require('../src/services/wms/inventoryService');
const receiptService = require('../src/services/wms/receiptService');
const transferService = require('../src/services/wms/transferService');

const results = [];
function check(name, cond, extra = '') {
  const ok = Boolean(cond);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function expectAppError(name, fn, matcher) {
  try {
    await fn();
    check(name, false, 'no error thrown');
  } catch (error) {
    const byStatus = matcher?.statusCode ? error?.statusCode === matcher.statusCode : true;
    const byCode = matcher?.code ? error?.code === matcher.code : true;
    const isExpectedType = error instanceof AppError;
    check(
      name,
      isExpectedType && byStatus && byCode,
      `status=${error?.statusCode} code=${error?.code} msg="${error?.message}"`
    );
  }
}

async function countPzMoves({ companyId, receiptId, receiptItemId }, transaction) {
  return StockMove.count({
    where: {
      companyId,
      refType: 'PZ',
      refId: receiptId,
      refItemId: receiptItemId,
      type: 'receipt',
    },
    transaction,
  });
}

async function countMmMoves({ companyId, transferId, transferItemId }, transaction) {
  return StockMove.count({
    where: {
      companyId,
      refType: 'MM',
      refId: transferId,
      refItemId: transferItemId,
      type: 'transfer',
    },
    transaction,
  });
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const company = await Company.create({ name: 'T1.2a Posting Smoke Company' }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'T12A-WH',
        name: 'T1.2a Warehouse',
        isActive: true,
      },
      { transaction: t }
    );

    const locA = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'T12A-A',
        type: 'bulk',
      },
      { transaction: t }
    );
    const locB = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'T12A-B',
        type: 'bulk',
      },
      { transaction: t }
    );

    // ---------------------------
    // PZ: full receive + idempotent retry
    // ---------------------------
    const pzProductFull = crypto.randomUUID();
    const receiptFull = await receiptService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        items: [{ productId: pzProductFull, variantId: null, qtyExpected: 10 }],
      },
      t
    );
    const receiptFullItem = receiptFull.items[0];

    await receiptService.receiveLine(
      companyId,
      receiptFullItem.id,
      { qty: 10, toLocationId: locA.id, lotId: null },
      t
    );

    const pzOnHandAfterFirst = await inventoryService.getOnHand(
      { companyId, warehouseId: warehouse.id, productId: pzProductFull, variantId: null },
      { transaction: t }
    );
    check('PZ receive 10 -> onHand = 10', pzOnHandAfterFirst === 10, `onHand=${pzOnHandAfterFirst}`);

    const pzMovesAfterFirst = await countPzMoves(
      { companyId, receiptId: receiptFull.id, receiptItemId: receiptFullItem.id },
      t
    );
    check('PZ full receive creates one stock_move', pzMovesAfterFirst === 1, `moves=${pzMovesAfterFirst}`);
    const pzMove = await StockMove.findOne({
      where: { companyId, refType: 'PZ', refId: receiptFull.id, refItemId: receiptFullItem.id, type: 'receipt' },
      transaction: t,
    });
    check('PZ move persists ref_item_id', pzMove && pzMove.refItemId === receiptFullItem.id, `refItemId=${pzMove && pzMove.refItemId}`);

    const pzRepeatResult = await receiptService.receiveLine(
      companyId,
      receiptFullItem.id,
      { qty: 10, toLocationId: locA.id, lotId: null },
      t
    );
    const pzOnHandAfterRepeat = await inventoryService.getOnHand(
      { companyId, warehouseId: warehouse.id, productId: pzProductFull, variantId: null },
      { transaction: t }
    );
    const pzMovesAfterRepeat = await countPzMoves(
      { companyId, receiptId: receiptFull.id, receiptItemId: receiptFullItem.id },
      t
    );
    check('PZ repeat receive on closed line does not double inventory', pzOnHandAfterRepeat === 10, `onHand=${pzOnHandAfterRepeat}`);
    check('PZ repeat receive on closed line does not duplicate stock_moves', pzMovesAfterRepeat === pzMovesAfterFirst, `before=${pzMovesAfterFirst} after=${pzMovesAfterRepeat}`);
    check('PZ repeat receive returns closed item', Number(pzRepeatResult.qtyReceived) === 10, `qtyReceived=${pzRepeatResult.qtyReceived}`);

    // ---------------------------
    // PZ: partial receive + exceed guard
    // ---------------------------
    const pzProductPartial = crypto.randomUUID();
    const receiptPartial = await receiptService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        items: [{ productId: pzProductPartial, variantId: null, qtyExpected: 10 }],
      },
      t
    );
    const receiptPartialItem = receiptPartial.items[0];

    const pzPartial1 = await receiptService.receiveLine(
      companyId,
      receiptPartialItem.id,
      { qty: 6, toLocationId: locA.id, lotId: null },
      t
    );
    check('PZ partial receive updates qtyReceived', Number(pzPartial1.qtyReceived) === 6, `qtyReceived=${pzPartial1.qtyReceived}`);

    await expectAppError(
      'PZ receive cannot exceed qtyExpected',
      () => receiptService.receiveLine(companyId, receiptPartialItem.id, { qty: 5, toLocationId: locA.id, lotId: null }, t),
      { statusCode: 409, code: 'QTY_EXCEEDS_EXPECTED' }
    );

    const pzPartial2 = await receiptService.receiveLine(
      companyId,
      receiptPartialItem.id,
      { qty: 4, toLocationId: locA.id, lotId: null },
      t
    );
    check('PZ second partial receive can close line exactly', Number(pzPartial2.qtyReceived) === 10, `qtyReceived=${pzPartial2.qtyReceived}`);

    // ---------------------------
    // MM: full execute + idempotent retry
    // ---------------------------
    const mmProductFull = crypto.randomUUID();
    await inventoryService.applyMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: mmProductFull,
        variantId: null,
        qty: 8,
        refType: 'PZ',
        refId: warehouse.id,
      },
      { transaction: t }
    );

    const transferFull = await transferService.create(
      companyId,
      {
        fromWarehouseId: warehouse.id,
        toWarehouseId: warehouse.id,
        items: [{ productId: mmProductFull, variantId: null, qty: 4 }],
      },
      t
    );
    const transferFullItem = await TransferItem.findOne({ where: { transferId: transferFull.id }, transaction: t });

    await transferService.executeLine(
      companyId,
      transferFullItem.id,
      { qty: 4, fromLocationId: locA.id, toLocationId: locB.id },
      t
    );

    const mmMovesAfterFirst = await countMmMoves(
      { companyId, transferId: transferFull.id, transferItemId: transferFullItem.id },
      t
    );
    check('MM execute full line creates two stock_moves (out+in)', mmMovesAfterFirst === 2, `moves=${mmMovesAfterFirst}`);
    const mmMoveWithRefItem = await StockMove.count({
      where: { companyId, refType: 'MM', refId: transferFull.id, refItemId: transferFullItem.id, type: 'transfer' },
      transaction: t,
    });
    check('MM moves persist ref_item_id', mmMoveWithRefItem === 2, `movesWithRefItem=${mmMoveWithRefItem}`);

    const mmRepeat = await transferService.executeLine(
      companyId,
      transferFullItem.id,
      { qty: 4, fromLocationId: locA.id, toLocationId: locB.id },
      t
    );
    const mmMovesAfterRepeat = await countMmMoves(
      { companyId, transferId: transferFull.id, transferItemId: transferFullItem.id },
      t
    );
    check('MM repeat execute on closed line does not duplicate stock_moves', mmMovesAfterRepeat === mmMovesAfterFirst, `before=${mmMovesAfterFirst} after=${mmMovesAfterRepeat}`);
    check('MM repeat execute on closed line keeps movedQty', Number(mmRepeat.movedQty) === 4, `movedQty=${mmRepeat.movedQty}`);

    // ---------------------------
    // MM: partial execute + exceed guard
    // ---------------------------
    const mmProductPartial = crypto.randomUUID();
    await inventoryService.applyMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: mmProductPartial,
        variantId: null,
        qty: 10,
        refType: 'PZ',
        refId: warehouse.id,
      },
      { transaction: t }
    );

    const transferPartial = await transferService.create(
      companyId,
      {
        fromWarehouseId: warehouse.id,
        toWarehouseId: warehouse.id,
        items: [{ productId: mmProductPartial, variantId: null, qty: 5 }],
      },
      t
    );
    const transferPartialItem = await TransferItem.findOne({ where: { transferId: transferPartial.id }, transaction: t });

    const mmPartial1 = await transferService.executeLine(
      companyId,
      transferPartialItem.id,
      { qty: 2, fromLocationId: locA.id, toLocationId: locB.id },
      t
    );
    check('MM partial execute updates movedQty', Number(mmPartial1.movedQty) === 2, `movedQty=${mmPartial1.movedQty}`);

    await expectAppError(
      'MM execute cannot exceed planned qty',
      () => transferService.executeLine(companyId, transferPartialItem.id, { qty: 4, fromLocationId: locA.id, toLocationId: locB.id }, t),
      { statusCode: 409, code: 'QTY_EXCEEDS_PLANNED' }
    );

    const mmPartial2 = await transferService.executeLine(
      companyId,
      transferPartialItem.id,
      { qty: 3, fromLocationId: locA.id, toLocationId: locB.id },
      t
    );
    check('MM second partial execute can close line exactly', Number(mmPartial2.movedQty) === 5, `movedQty=${mmPartial2.movedQty}`);

    const mmPartialMovesBeforeRepeat = await countMmMoves(
      { companyId, transferId: transferPartial.id, transferItemId: transferPartialItem.id },
      t
    );
    await transferService.executeLine(
      companyId,
      transferPartialItem.id,
      { qty: 1, fromLocationId: locA.id, toLocationId: locB.id },
      t
    );
    const mmPartialMovesAfterRepeat = await countMmMoves(
      { companyId, transferId: transferPartial.id, transferItemId: transferPartialItem.id },
      t
    );
    check(
      'MM repeat after close does not duplicate stock_moves',
      mmPartialMovesAfterRepeat === mmPartialMovesBeforeRepeat,
      `before=${mmPartialMovesBeforeRepeat} after=${mmPartialMovesAfterRepeat}`
    );
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
