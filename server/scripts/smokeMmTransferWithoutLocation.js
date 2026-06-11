'use strict';

// Runtime smoke for WMS-POLICY-2C-3 MM transfer without source/target locations.
//
// The script runs inside one transaction and always rolls back.
//
// Run:
//   node scripts/smokeMmTransferWithoutLocation.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Warehouse,
  Location,
  Product,
  InventoryItem,
  TransferOrder,
  StockMove,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const inventoryService = require('../src/services/wms/inventoryService');
const transferService = require('../src/services/wms/transferService');
const costingService = require('../src/services/wms/costingService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function expectAppErrorIsolated(name, expectedCode, outerT, fn) {
  try {
    await sequelize.transaction({ transaction: outerT }, async (sp) => {
      await fn(sp);
    });
    check(name, false, 'no error thrown');
  } catch (error) {
    check(
      name,
      error instanceof AppError && error.code === expectedCode,
      `status=${error.statusCode || 'null'} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

async function inventoryQty({ companyId, warehouseId, locationId, productId, transaction }) {
  const row = await InventoryItem.findOne({
    where: {
      companyId,
      warehouseId,
      locationId,
      productId,
      variantId: null,
      lotId: null,
      serialId: null,
    },
    transaction,
  });
  return asNumber(row?.qtyOnHand);
}

async function createProduct(companyId, suffix, label, transaction) {
  return Product.create(
    {
      id: crypto.randomUUID(),
      companyId,
      sku: `P2C3-${label}-${suffix}`.slice(0, 64),
      name: `Policy2C3 ${label} ${suffix}`,
      slug: `policy2c3-${label.toLowerCase()}-${suffix}`,
      status: 'active',
      trackInventory: true,
      isService: false,
      cost: 20,
      currency: 'PLN',
    },
    { transaction }
  );
}

async function seedStock({ companyId, warehouseId, locationId, productId, qty, transaction }) {
  const move = await inventoryService.applyMove(
    {
      companyId,
      type: 'receipt',
      warehouseId,
      toLocationId: locationId,
      productId,
      variantId: null,
      qty,
      refType: 'TEST',
      refId: crypto.randomUUID(),
      refItemId: crypto.randomUUID(),
    },
    { transaction }
  );
  await costingService.applyCostingForMove(
    move,
    { costInput: { unitCost: 20, currency: 'PLN' } },
    transaction
  );
  return move;
}

async function createTransfer({ companyId, sourceWarehouseId, targetWarehouseId, sourceLocationId, targetLocationId, productId, qty, transaction }) {
  const transfer = await transferService.create(
    companyId,
    {
      fromWarehouseId: sourceWarehouseId,
      toWarehouseId: targetWarehouseId,
      sourceLocationId,
      targetLocationId,
      items: [{ productId, variantId: null, qty }],
    },
    transaction
  );
  const item = transfer.items?.[0] || await transfer.getItems({ transaction }).then((rows) => rows[0]);
  return { transfer, item };
}

async function executeAndLoadMoves({ companyId, transferId, itemId, qty, payload = {}, transaction }) {
  const item = await transferService.executeLine(
    companyId,
    itemId,
    { qty, ...payload },
    transaction
  );
  const moves = await StockMove.findAll({
    where: {
      companyId,
      refType: 'MM',
      refId: transferId,
      refItemId: itemId,
      type: 'transfer',
    },
    order: [['createdAt', 'ASC']],
    transaction,
  });
  return { item, moves };
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const company = await Company.create({ name: `Policy2C3 Smoke ${suffix}` }, { transaction: t });
    await CompanyWarehouseDocumentSetting.create(
      { companyId: company.id, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );
    const sourceWarehouse = await Warehouse.create(
      { id: crypto.randomUUID(), companyId: company.id, code: `P2C3-S-${suffix}`.slice(0, 32), name: 'Policy2C3 Source', isActive: true },
      { transaction: t }
    );
    const targetWarehouse = await Warehouse.create(
      { id: crypto.randomUUID(), companyId: company.id, code: `P2C3-T-${suffix}`.slice(0, 32), name: 'Policy2C3 Target', isActive: true },
      { transaction: t }
    );
    const sourceLocation = await Location.create(
      { id: crypto.randomUUID(), companyId: company.id, warehouseId: sourceWarehouse.id, code: `SRC-${suffix}`.slice(0, 64), type: 'bulk' },
      { transaction: t }
    );
    const targetLocation = await Location.create(
      { id: crypto.randomUUID(), companyId: company.id, warehouseId: targetWarehouse.id, code: `TGT-${suffix}`.slice(0, 64), type: 'bulk' },
      { transaction: t }
    );

    const warehouseProduct = await createProduct(company.id, suffix, 'WAREHOUSE', t);
    await seedStock({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: null,
      productId: warehouseProduct.id,
      qty: 10,
      transaction: t,
    });
    const warehouseTransfer = await createTransfer({
      companyId: company.id,
      sourceWarehouseId: sourceWarehouse.id,
      targetWarehouseId: targetWarehouse.id,
      sourceLocationId: null,
      targetLocationId: null,
      productId: warehouseProduct.id,
      qty: 4,
      transaction: t,
    });
    const warehouseExec = await executeAndLoadMoves({
      companyId: company.id,
      transferId: warehouseTransfer.transfer.id,
      itemId: warehouseTransfer.item.id,
      qty: 4,
      transaction: t,
    });
    const warehouseOrder = await TransferOrder.findByPk(warehouseTransfer.transfer.id, { transaction: t });
    const sourceWarehouseQty = await inventoryQty({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: null,
      productId: warehouseProduct.id,
      transaction: t,
    });
    const targetWarehouseQty = await inventoryQty({
      companyId: company.id,
      warehouseId: targetWarehouse.id,
      locationId: null,
      productId: warehouseProduct.id,
      transaction: t,
    });
    check('MM without locations updates movedQty', asNumber(warehouseExec.item?.movedQty) === 4, `movedQty=${warehouseExec.item?.movedQty}`);
    check('MM without locations closes transfer as received', warehouseOrder?.status === 'received', `status=${warehouseOrder?.status}`);
    check('MM without locations decreases source warehouse-level stock', sourceWarehouseQty === 6, `qty=${sourceWarehouseQty}`);
    check('MM without locations increases target warehouse-level stock', targetWarehouseQty === 4, `qty=${targetWarehouseQty}`);
    check(
      'MM without locations writes null transfer StockMoves',
      warehouseExec.moves.length === 2
        && warehouseExec.moves.some((move) => move.fromLocationId === null && move.toLocationId === null && move.warehouseId === sourceWarehouse.id)
        && warehouseExec.moves.some((move) => move.fromLocationId === null && move.toLocationId === null && move.warehouseId === targetWarehouse.id),
      `moves=${warehouseExec.moves.length}`
    );

    const locationProduct = await createProduct(company.id, suffix, 'LOCATION', t);
    await seedStock({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: sourceLocation.id,
      productId: locationProduct.id,
      qty: 8,
      transaction: t,
    });
    const locationTransfer = await createTransfer({
      companyId: company.id,
      sourceWarehouseId: sourceWarehouse.id,
      targetWarehouseId: targetWarehouse.id,
      sourceLocationId: sourceLocation.id,
      targetLocationId: targetLocation.id,
      productId: locationProduct.id,
      qty: 3,
      transaction: t,
    });
    const locationExec = await executeAndLoadMoves({
      companyId: company.id,
      transferId: locationTransfer.transfer.id,
      itemId: locationTransfer.item.id,
      qty: 3,
      transaction: t,
    });
    const sourceLocationQty = await inventoryQty({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: sourceLocation.id,
      productId: locationProduct.id,
      transaction: t,
    });
    const targetLocationQty = await inventoryQty({
      companyId: company.id,
      warehouseId: targetWarehouse.id,
      locationId: targetLocation.id,
      productId: locationProduct.id,
      transaction: t,
    });
    check('MM with locations still decreases source location-level stock', sourceLocationQty === 5, `qty=${sourceLocationQty}`);
    check('MM with locations still increases target location-level stock', targetLocationQty === 3, `qty=${targetLocationQty}`);
    check(
      'MM with locations still writes location StockMoves',
      locationExec.moves.length === 2
        && locationExec.moves.some((move) => move.fromLocationId === sourceLocation.id && move.toLocationId === null)
        && locationExec.moves.some((move) => move.fromLocationId === null && move.toLocationId === targetLocation.id),
      `moves=${locationExec.moves.length}`
    );

    const mixedOutProduct = await createProduct(company.id, suffix, 'MIXED-OUT', t);
    await seedStock({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: sourceLocation.id,
      productId: mixedOutProduct.id,
      qty: 6,
      transaction: t,
    });
    const mixedOutTransfer = await createTransfer({
      companyId: company.id,
      sourceWarehouseId: sourceWarehouse.id,
      targetWarehouseId: targetWarehouse.id,
      sourceLocationId: sourceLocation.id,
      targetLocationId: null,
      productId: mixedOutProduct.id,
      qty: 2,
      transaction: t,
    });
    await executeAndLoadMoves({
      companyId: company.id,
      transferId: mixedOutTransfer.transfer.id,
      itemId: mixedOutTransfer.item.id,
      qty: 2,
      transaction: t,
    });
    const mixedOutSourceQty = await inventoryQty({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: sourceLocation.id,
      productId: mixedOutProduct.id,
      transaction: t,
    });
    const mixedOutTargetQty = await inventoryQty({
      companyId: company.id,
      warehouseId: targetWarehouse.id,
      locationId: null,
      productId: mixedOutProduct.id,
      transaction: t,
    });
    check('MM mixed location -> warehouse-level decreases source location', mixedOutSourceQty === 4, `qty=${mixedOutSourceQty}`);
    check('MM mixed location -> warehouse-level increases target warehouse-level', mixedOutTargetQty === 2, `qty=${mixedOutTargetQty}`);

    const mixedInProduct = await createProduct(company.id, suffix, 'MIXED-IN', t);
    await seedStock({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: null,
      productId: mixedInProduct.id,
      qty: 6,
      transaction: t,
    });
    const mixedInTransfer = await createTransfer({
      companyId: company.id,
      sourceWarehouseId: sourceWarehouse.id,
      targetWarehouseId: targetWarehouse.id,
      sourceLocationId: null,
      targetLocationId: targetLocation.id,
      productId: mixedInProduct.id,
      qty: 2,
      transaction: t,
    });
    await executeAndLoadMoves({
      companyId: company.id,
      transferId: mixedInTransfer.transfer.id,
      itemId: mixedInTransfer.item.id,
      qty: 2,
      transaction: t,
    });
    const mixedInSourceQty = await inventoryQty({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: null,
      productId: mixedInProduct.id,
      transaction: t,
    });
    const mixedInTargetQty = await inventoryQty({
      companyId: company.id,
      warehouseId: targetWarehouse.id,
      locationId: targetLocation.id,
      productId: mixedInProduct.id,
      transaction: t,
    });
    check('MM mixed warehouse-level -> location decreases source warehouse-level', mixedInSourceQty === 4, `qty=${mixedInSourceQty}`);
    check('MM mixed warehouse-level -> location increases target location', mixedInTargetQty === 2, `qty=${mixedInTargetQty}`);

    const negativeProduct = await createProduct(company.id, suffix, 'NEGATIVE', t);
    await seedStock({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: sourceLocation.id,
      productId: negativeProduct.id,
      qty: 5,
      transaction: t,
    });
    const negativeTransfer = await createTransfer({
      companyId: company.id,
      sourceWarehouseId: sourceWarehouse.id,
      targetWarehouseId: targetWarehouse.id,
      sourceLocationId: null,
      targetLocationId: null,
      productId: negativeProduct.id,
      qty: 2,
      transaction: t,
    });
    await expectAppErrorIsolated(
      'MM without source location does not consume location-level-only stock',
      'INSUFFICIENT_STOCK',
      t,
      (sp) => transferService.executeLine(company.id, negativeTransfer.item.id, { qty: 2 }, sp)
    );
    const negativeLocationQty = await inventoryQty({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: sourceLocation.id,
      productId: negativeProduct.id,
      transaction: t,
    });
    const negativeWarehouseQty = await inventoryQty({
      companyId: company.id,
      warehouseId: sourceWarehouse.id,
      locationId: null,
      productId: negativeProduct.id,
      transaction: t,
    });
    const negativeMoveCount = await StockMove.count({
      where: {
        companyId: company.id,
        refType: 'MM',
        refId: negativeTransfer.transfer.id,
        refItemId: negativeTransfer.item.id,
        type: 'transfer',
      },
      transaction: t,
    });
    check('Negative MM leaves source location-level stock unchanged', negativeLocationQty === 5, `qty=${negativeLocationQty}`);
    check('Negative MM does not create source warehouse-level stock bucket', negativeWarehouseQty === 0, `qty=${negativeWarehouseQty}`);
    check('Negative MM does not create stock moves', negativeMoveCount === 0, `moves=${negativeMoveCount}`);
  } catch (error) {
    check('script execution', false, error && error.message);
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    if (t) {
      await t.rollback();
      // eslint-disable-next-line no-console
      console.log('-- transaction rolled back (no data persisted) --');
    }
    await sequelize.close();
  }

  const failed = results.filter((result) => !result.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();
