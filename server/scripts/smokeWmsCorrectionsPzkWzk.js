'use strict';

// K1.3 smoke — receiptService.createReceiptCorrection (PZK) +
// shipmentService.createShipmentCorrection (WZK).
//
// NON-DESTRUCTIVE: everything happens inside a single outer transaction that is always
// rolled back. The named-args costing service calls all participate in that transaction.
//
// Scenarios:
//   A. WZK — PZ 10×20 → WZ 4 → WZK 4 → qty_on_hand 6→10, original WZ corrected, layer restored.
//   B. PZK success — PZ 5×20 → PZK 5 before consumption → qty_on_hand 5→0, original corrected.
//   C. PZK hard reject — PZ 10×20 → WZ 3 → PZK 10 → 409 LAYER_PARTIALLY_CONSUMED.
//   D. Double-correct reject — WZ already corrected → second WZK → 409 DOCUMENT_ALREADY_CORRECTED.
//   E. Correction-of-correction reject — WZK as input → 409 CORRECTION_OF_CORRECTION_NOT_ALLOWED.

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  CostLayer,
  InventoryItem,
  Location,
  Product,
  Receipt,
  ReceiptItem,
  Shipment,
  ShipmentItem,
  StockMove,
  StockMoveCostAllocation,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const Inventory = require('../src/services/wms/inventoryService');
const costingService = require('../src/services/wms/costingService');

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

async function postPzReceipt({ companyId, warehouseId, locationId, productId, qty, unitCost }, t) {
  // Create a 'received' PZ with one item directly so the smoke stays in-transaction.
  const r = await Receipt.create(
    { companyId, warehouseId, number: `PZ-K13-${crypto.randomUUID().slice(0, 6)}`, status: 'draft' },
    { transaction: t }
  );
  const item = await ReceiptItem.create(
    {
      receiptId: r.id,
      productId,
      qtyExpected: qty,
      qtyReceived: qty,
      unitCost,
      currency: 'PLN',
    },
    { transaction: t }
  );
  const move = await Inventory.applyMove(
    {
      companyId,
      type: 'receipt',
      warehouseId,
      toLocationId: locationId,
      productId,
      qty,
      refType: 'PZ',
      refId: r.id,
      refItemId: item.id,
    },
    { transaction: t }
  );
  await costingService.applyCostingForMove(move, { costInput: { unitCost, currency: 'PLN' } }, t);
  await r.update({ status: 'received' }, { transaction: t });
  return { receipt: await r.reload({ transaction: t }), item, move };
}

async function postWzShipment({ companyId, warehouseId, locationId, productId, qty }, t) {
  const s = await Shipment.create(
    { companyId, warehouseId, number: `WZ-K13-${crypto.randomUUID().slice(0, 6)}`, status: 'packing' },
    { transaction: t }
  );
  const item = await ShipmentItem.create(
    { shipmentId: s.id, productId, qty },
    { transaction: t }
  );
  const move = await Inventory.applyMove(
    {
      companyId,
      type: 'ship',
      warehouseId,
      fromLocationId: locationId,
      productId,
      qty,
      refType: 'WZ',
      refId: s.id,
      refItemId: item.id,
    },
    { transaction: t }
  );
  await costingService.applyCostingForMove(move, {}, t);
  await s.update({ status: 'shipped' }, { transaction: t });
  return { shipment: await s.reload({ transaction: t }), item, move };
}

async function getOnHand({ companyId, warehouseId, locationId, productId }, t) {
  const row = await InventoryItem.findOne({
    where: { companyId, warehouseId, locationId, productId, variantId: null, lotId: null, serialId: null },
    transaction: t,
  });
  return row ? n(row.qtyOnHand) : 0;
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `K1.3 Corrections Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouse = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'K13-WH', name: 'K1.3 WH', isActive: true },
      { transaction: t }
    );
    const warehouseId = warehouse.id;
    const locA = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId, code: 'K13-A', type: 'bulk' },
      { transaction: t }
    );
    const locationId = locA.id;

    // ============================================================
    // Scenario A: WZK reverses a shipped WZ; qty_on_hand restored.
    // ============================================================
    const aProduct = await Product.create(
      { id: crypto.randomUUID(), companyId, name: 'K1.3 A Product', slug: `k13-a-${suffix}`, sku: 'K13-A' },
      { transaction: t }
    );
    const aPz = await postPzReceipt({ companyId, warehouseId, locationId, productId: aProduct.id, qty: 10, unitCost: 20 }, t);
    const aWz = await postWzShipment({ companyId, warehouseId, locationId, productId: aProduct.id, qty: 4 }, t);
    const aOnHandPreCorrection = await getOnHand({ companyId, warehouseId, locationId, productId: aProduct.id }, t);
    check('A pre-WZK: qty_on_hand = 6 (10 PZ − 4 WZ)', aOnHandPreCorrection === 6, `oh=${aOnHandPreCorrection}`);

    const aWzk = await shipmentService.createShipmentCorrection(
      companyId,
      aWz.shipment.id,
      { items: [{ originalItemId: aWz.item.id, qty: 4 }] },
      { transaction: t }
    );
    check('A: WZK created with parentDocumentId set',
      aWzk && aWzk.parentDocumentId === aWz.shipment.id,
      `parent=${aWzk && aWzk.parentDocumentId}`);
    check('A: WZK status=shipped', aWzk.status === 'shipped', `status=${aWzk.status}`);
    check('A: WZK number prefix=WZK', String(aWzk.number || '').startsWith('WZK/'),
      `num=${aWzk.number}`);

    const aOnHandAfter = await getOnHand({ companyId, warehouseId, locationId, productId: aProduct.id }, t);
    check('A: qty_on_hand restored 6 → 10', aOnHandAfter === 10, `oh=${aOnHandAfter}`);

    const aWzReloaded = await Shipment.findByPk(aWz.shipment.id, { transaction: t });
    check('A: original WZ.status=corrected', aWzReloaded.status === 'corrected', `s=${aWzReloaded.status}`);
    check('A: original WZ.correctedById=WZK id', aWzReloaded.correctedById === aWzk.id,
      `correctedById=${aWzReloaded.correctedById}`);

    const aAlloc = await StockMoveCostAllocation.findOne({
      where: { stockMoveId: aWz.move.id }, transaction: t,
    });
    check('A: WZ allocation soft-marked reversedAt + reversedByStockMoveId',
      aAlloc && aAlloc.reversedAt instanceof Date && aAlloc.reversedByStockMoveId,
      `reversedAt=${aAlloc && aAlloc.reversedAt} ref=${aAlloc && aAlloc.reversedByStockMoveId}`);

    const aLayer = await CostLayer.findOne({ where: { sourceMoveId: aPz.move.id }, transaction: t });
    check('A: PZ layer qtyRemaining restored 6 → 10', n(aLayer.qtyRemaining) === 10,
      `remaining=${aLayer.qtyRemaining}`);

    // ============================================================
    // Scenario B: PZK 5 on an intact PZ 5×20 — qty_on_hand 5→0, layer fully zeroed.
    // ============================================================
    const bProduct = await Product.create(
      { id: crypto.randomUUID(), companyId, name: 'K1.3 B Product', slug: `k13-b-${suffix}`, sku: 'K13-B' },
      { transaction: t }
    );
    const bPz = await postPzReceipt({ companyId, warehouseId, locationId, productId: bProduct.id, qty: 5, unitCost: 20 }, t);
    const bOnHandPre = await getOnHand({ companyId, warehouseId, locationId, productId: bProduct.id }, t);
    check('B pre-PZK: qty_on_hand = 5', bOnHandPre === 5, `oh=${bOnHandPre}`);

    const bPzk = await receiptService.createReceiptCorrection(
      companyId,
      bPz.receipt.id,
      { items: [{ originalItemId: bPz.item.id, qty: 5 }] },
      { transaction: t }
    );
    check('B: PZK created with parentDocumentId set',
      bPzk && bPzk.parentDocumentId === bPz.receipt.id,
      `parent=${bPzk && bPzk.parentDocumentId}`);
    check('B: PZK number prefix=PZK', String(bPzk.number || '').startsWith('PZK/'),
      `num=${bPzk.number}`);

    const bOnHandAfter = await getOnHand({ companyId, warehouseId, locationId, productId: bProduct.id }, t);
    check('B: qty_on_hand reduced 5 → 0', bOnHandAfter === 0, `oh=${bOnHandAfter}`);

    const bReceiptReloaded = await Receipt.findByPk(bPz.receipt.id, { transaction: t });
    check('B: original PZ.status=corrected', bReceiptReloaded.status === 'corrected',
      `s=${bReceiptReloaded.status}`);
    check('B: original PZ.correctedById=PZK id',
      bReceiptReloaded.correctedById === bPzk.id, `correctedById=${bReceiptReloaded.correctedById}`);

    const bLayer = await CostLayer.findOne({ where: { sourceMoveId: bPz.move.id }, transaction: t });
    check('B: layer qtyRemaining 5 → 0', n(bLayer.qtyRemaining) === 0,
      `remaining=${bLayer.qtyRemaining}`);

    // ============================================================
    // Scenario C: PZK hard-reject — PZ 10, WZ 3, attempt PZK 10 → LAYER_PARTIALLY_CONSUMED.
    // ============================================================
    const cProduct = await Product.create(
      { id: crypto.randomUUID(), companyId, name: 'K1.3 C Product', slug: `k13-c-${suffix}`, sku: 'K13-C' },
      { transaction: t }
    );
    const cPz = await postPzReceipt({ companyId, warehouseId, locationId, productId: cProduct.id, qty: 10, unitCost: 20 }, t);
    await postWzShipment({ companyId, warehouseId, locationId, productId: cProduct.id, qty: 3 }, t);
    await expectAppError(
      'C: PZK on partially-consumed layer → 409 LAYER_PARTIALLY_CONSUMED',
      'LAYER_PARTIALLY_CONSUMED',
      () => receiptService.createReceiptCorrection(
        companyId,
        cPz.receipt.id,
        { items: [{ originalItemId: cPz.item.id, qty: 10 }] },
        { transaction: t }
      )
    );
    const cReceiptReloaded = await Receipt.findByPk(cPz.receipt.id, { transaction: t });
    check('C: original PZ.status unchanged (still received)',
      cReceiptReloaded.status === 'received' && !cReceiptReloaded.correctedById,
      `s=${cReceiptReloaded.status} correctedById=${cReceiptReloaded.correctedById}`);

    // ============================================================
    // Scenario D: Second WZK against an already-corrected WZ → DOCUMENT_ALREADY_CORRECTED.
    // (Re-uses Scenario A's corrected WZ.)
    // ============================================================
    await expectAppError(
      'D: second WZK on already-corrected WZ → 409 DOCUMENT_ALREADY_CORRECTED',
      'DOCUMENT_ALREADY_CORRECTED',
      () => shipmentService.createShipmentCorrection(
        companyId,
        aWz.shipment.id,
        { items: [{ originalItemId: aWz.item.id, qty: 1 }] },
        { transaction: t }
      )
    );

    // ============================================================
    // Scenario E: correction of a correction document → CORRECTION_OF_CORRECTION_NOT_ALLOWED.
    // We try to WZK the WZK from Scenario A.
    // ============================================================
    await expectAppError(
      'E: WZK against existing WZK → 409 CORRECTION_OF_CORRECTION_NOT_ALLOWED',
      'CORRECTION_OF_CORRECTION_NOT_ALLOWED',
      () => shipmentService.createShipmentCorrection(
        companyId,
        aWzk.id,
        { items: [{ originalItemId: aWzk.items[0].id, qty: 1 }] },
        { transaction: t }
      )
    );
    // Same for receipt side: PZK against the PZK from Scenario B.
    await expectAppError(
      'E (mirror): PZK against existing PZK → 409 CORRECTION_OF_CORRECTION_NOT_ALLOWED',
      'CORRECTION_OF_CORRECTION_NOT_ALLOWED',
      () => receiptService.createReceiptCorrection(
        companyId,
        bPzk.id,
        { items: [{ originalItemId: bPzk.items[0].id, qty: 1 }] },
        { transaction: t }
      )
    );

    // Sanity: WZK from scenario A actually persisted a reverse stock_move with refType='WZ_KOREKTA'.
    const aReverseMoves = await StockMove.findAll({
      where: { companyId, refType: 'WZ_KOREKTA', refId: aWzk.id }, transaction: t,
    });
    check('A: WZK produced one reverse stock_move (refType=WZ_KOREKTA)',
      aReverseMoves.length === 1, `rows=${aReverseMoves.length}`);
    check('A: WZK reverse move type=receipt (credits qty_on_hand back)',
      aReverseMoves[0] && aReverseMoves[0].type === 'receipt',
      `type=${aReverseMoves[0] && aReverseMoves[0].type}`);
    check('A: WZK reverse move references original WZ via reversesMoveId',
      aReverseMoves[0] && aReverseMoves[0].reversesMoveId === aWz.move.id,
      `ref=${aReverseMoves[0] && aReverseMoves[0].reversesMoveId}`);

    const bReverseMoves = await StockMove.findAll({
      where: { companyId, refType: 'PZ_KOREKTA', refId: bPzk.id }, transaction: t,
    });
    check('B: PZK produced one reverse stock_move (refType=PZ_KOREKTA)',
      bReverseMoves.length === 1, `rows=${bReverseMoves.length}`);
    check('B: PZK reverse move type=ship (debits qty_on_hand)',
      bReverseMoves[0] && bReverseMoves[0].type === 'ship',
      `type=${bReverseMoves[0] && bReverseMoves[0].type}`);
    check('B: PZK reverse move references original PZ via reversesMoveId',
      bReverseMoves[0] && bReverseMoves[0].reversesMoveId === bPz.move.id,
      `ref=${bReverseMoves[0] && bReverseMoves[0].reversesMoveId}`);
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
