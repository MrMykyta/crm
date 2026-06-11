'use strict';

// End-to-end runtime smoke for WMS-POLICY-2E: full zero-location WMS flow.
//
// Creates a real company through the normal company bootstrap, verifies MAIN
// exists and no Location rows exist, then runs PZ/WZ/MM/PW/RW/Cycle Count with
// warehouse-level stock only.
//
// Run from the backend container or local backend runtime:
//   node scripts/smokeLocationOptionalRuntime.js

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');

const {
  sequelize,
  User,
  CompanyWarehouseDocumentSetting,
  Warehouse,
  Location,
  Product,
  InventoryItem,
  StockMove,
  TransferItem,
  Adjustment,
  AdjustmentItem,
  CountItem,
} = require('../src/models');
const companyService = require('../src/services/crm/companyService');
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const transferService = require('../src/services/wms/transferService');
const adjustmentService = require('../src/services/wms/adjustmentService');
const inventoryCountService = require('../src/services/wms/inventoryCountService');
const stockBalanceService = require('../src/services/wms/stockBalanceService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok, extra });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function inventoryQty(companyId, warehouseId, productId) {
  const row = await InventoryItem.findOne({
    where: {
      companyId,
      warehouseId,
      locationId: null,
      productId,
      variantId: null,
      lotId: null,
      serialId: null,
    },
  });
  return asNumber(row?.qtyOnHand);
}

async function stockBalanceQty(companyId, warehouseId, productId) {
  const rows = await stockBalanceService.listStockBalances(companyId, {
    warehouseId,
    productId,
  });
  const row = rows.find((entry) => entry.warehouseId === warehouseId && entry.productId === productId);
  return asNumber(row?.onHand);
}

async function writeResultFile(result) {
  const outputPath = process.env.WMS_LOCATION_OPTIONAL_SMOKE_OUT
    || path.join('/tmp', 'wms-location-optional-runtime-smoke-result.json');
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return outputPath;
}

(async () => {
  let exitCode = 0;
  let result = {};

  try {
    await sequelize.authenticate();

    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const password = 'Smoke123!LocationOptional';
    const email = `smoke-location-optional-${suffix}@example.com`;
    const user = await User.create({
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName: 'Smoke',
      lastName: 'LocationOptional',
      isActive: true,
      emailVerifiedAt: new Date(),
      createdBy: null,
    });

    const company = await companyService.createWithOwner(user.id, {
      name: `Zero Location WMS Smoke ${suffix}`,
    });
    const companyId = company.id;

    const [settings] = await CompanyWarehouseDocumentSetting.findOrCreate({
      where: { companyId },
      defaults: {
        companyId,
        inventoryCostMethod: 'FIFO',
        costingInitializedAt: new Date(),
      },
    });
    await settings.update({
      inventoryCostMethod: 'FIFO',
      costingInitializedAt: settings.costingInitializedAt || new Date(),
    });

    const mainWarehouse = await Warehouse.findOne({ where: { companyId, code: 'MAIN' } });
    check('new company has MAIN warehouse', mainWarehouse && mainWarehouse.isActive === true, mainWarehouse?.id || '');

    const initialLocationCount = await Location.count({ where: { companyId } });
    check('new company has zero locations', initialLocationCount === 0, `locations=${initialLocationCount}`);

    const targetWarehouse = await Warehouse.create({
      id: crypto.randomUUID(),
      companyId,
      code: `MM-${suffix}`.slice(0, 32),
      name: `MM Target ${suffix}`,
      isActive: true,
    });

    const locationCountAfterTargetWarehouse = await Location.count({ where: { companyId } });
    check(
      'creating second warehouse creates no locations',
      locationCountAfterTargetWarehouse === 0,
      `locations=${locationCountAfterTargetWarehouse}`
    );

    const product = await Product.create({
      companyId,
      name: `Zero Location Product ${suffix}`,
      slug: `zero-location-product-${suffix}`,
      sku: `ZLOC-${suffix}`.slice(0, 64),
      status: 'active',
      trackInventory: true,
      isService: false,
      cost: 10,
      currency: 'PLN',
    });

    const stockTimeline = [];
    const recordStock = async (label) => {
      const sourceQty = await inventoryQty(companyId, mainWarehouse.id, product.id);
      const targetQty = await inventoryQty(companyId, targetWarehouse.id, product.id);
      const sourceBalance = await stockBalanceQty(companyId, mainWarehouse.id, product.id);
      const targetBalance = await stockBalanceQty(companyId, targetWarehouse.id, product.id);
      stockTimeline.push({ label, sourceQty, targetQty, sourceBalance, targetBalance });
      return { sourceQty, targetQty, sourceBalance, targetBalance };
    };

    await recordStock('before');

    const receipt = await receiptService.create(companyId, {
      warehouseId: mainWarehouse.id,
      inboundLocationId: null,
      issueDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: product.id, qtyExpected: 100, unitCost: 10, currency: 'PLN' }],
    });
    const receiptItem = receipt.items[0];
    await receiptService.receiveLine(companyId, receiptItem.id, { qty: 100, toLocationId: null });
    const afterPz = await recordStock('after PZ +100');
    check('PZ increased warehouse-level stock to 100', afterPz.sourceQty === 100 && afterPz.sourceBalance === 100);

    const pzMove = await StockMove.findOne({
      where: {
        companyId,
        refType: 'PZ',
        refId: receipt.id,
        refItemId: receiptItem.id,
        type: 'receipt',
      },
    });
    check('PZ StockMove.toLocationId is null', pzMove && pzMove.toLocationId === null, pzMove?.id || '');

    const shipment = await shipmentService.create(companyId, {
      warehouseId: mainWarehouse.id,
      issueDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: product.id, qty: 10 }],
    });
    const shipmentItem = shipment.items[0];
    await shipmentService.shipItem(companyId, shipmentItem.id, { qty: 10, fromLocationId: null });
    const afterWz = await recordStock('after WZ -10');
    check('WZ decreased warehouse-level stock to 90', afterWz.sourceQty === 90 && afterWz.sourceBalance === 90);

    const wzMove = await StockMove.findOne({
      where: {
        companyId,
        refType: 'WZ',
        refId: shipment.id,
        refItemId: shipmentItem.id,
        type: 'ship',
      },
    });
    check('WZ StockMove.fromLocationId is null', wzMove && wzMove.fromLocationId === null, wzMove?.id || '');

    const transfer = await transferService.create(companyId, {
      fromWarehouseId: mainWarehouse.id,
      toWarehouseId: targetWarehouse.id,
      sourceLocationId: null,
      targetLocationId: null,
      issueDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: product.id, qty: 15 }],
    });
    const transferItem = await TransferItem.findOne({
      where: { transferId: transfer.id, productId: product.id },
    });
    await transferService.executeLine(companyId, transferItem.id, {
      qty: 15,
      fromLocationId: null,
      toLocationId: null,
    });
    const afterMm = await recordStock('after MM -15/+15');
    check('MM decreased source warehouse-level stock to 75', afterMm.sourceQty === 75 && afterMm.sourceBalance === 75);
    check('MM increased target warehouse-level stock to 15', afterMm.targetQty === 15 && afterMm.targetBalance === 15);

    const mmMoves = await StockMove.findAll({
      where: { companyId, refType: 'MM', refId: transfer.id, refItemId: transferItem.id, type: 'transfer' },
      order: [['createdAt', 'ASC']],
    });
    check(
      'MM StockMove location fields are null',
      mmMoves.length === 2 && mmMoves.every((move) => move.fromLocationId === null && move.toLocationId === null),
      `moves=${mmMoves.length}`
    );

    const pw = await adjustmentService.create(companyId, {
      documentType: 'PW',
      warehouseId: mainWarehouse.id,
      reason: `Policy2E PW ${suffix}`,
      items: [{ productId: product.id, locationId: null, qtyDelta: 8, unitCost: 10, currency: 'PLN' }],
    });
    await adjustmentService.post(companyId, pw.id);
    const afterPw = await recordStock('after PW +8');
    check('PW increased warehouse-level stock to 83', afterPw.sourceQty === 83 && afterPw.sourceBalance === 83);

    const pwMove = await StockMove.findOne({
      where: { companyId, refType: 'PW', refId: pw.id, type: 'adjustment' },
    });
    check('PW StockMove.toLocationId is null', pwMove && pwMove.toLocationId === null, pwMove?.id || '');

    const rw = await adjustmentService.create(companyId, {
      documentType: 'RW',
      warehouseId: mainWarehouse.id,
      reason: `Policy2E RW ${suffix}`,
      items: [{ productId: product.id, locationId: null, qtyDelta: -3, unitCost: 10, currency: 'PLN' }],
    });
    await adjustmentService.post(companyId, rw.id);
    const afterRw = await recordStock('after RW -3');
    check('RW decreased warehouse-level stock to 80', afterRw.sourceQty === 80 && afterRw.sourceBalance === 80);

    const rwMove = await StockMove.findOne({
      where: { companyId, refType: 'RW', refId: rw.id, type: 'adjustment' },
    });
    check('RW StockMove.fromLocationId is null', rwMove && rwMove.fromLocationId === null, rwMove?.id || '');

    const cycleCount = await inventoryCountService.createCycleCount(companyId, {
      warehouseId: mainWarehouse.id,
      items: [{ productId: product.id, locationId: null, qtyCounted: 70 }],
    });
    const reconciled = await inventoryCountService.reconcileCycleCount(cycleCount.id, { companyId });
    const afterCount = await recordStock('after Cycle Count =70');
    check('Cycle Count final warehouse-level stock equals counted qty 70', afterCount.sourceQty === 70 && afterCount.sourceBalance === 70);

    const countItem = await CountItem.findOne({
      where: { countId: cycleCount.id, productId: product.id },
    });
    check('Cycle Count item.locationId is null', countItem && countItem.locationId === null, countItem?.id || '');

    const reconcileAdjustment = await Adjustment.findOne({
      where: {
        companyId,
        reason: `Cycle count ${cycleCount.id} reconcile`,
      },
      include: [{ model: AdjustmentItem, as: 'items' }],
    });
    const reconcileItem = reconcileAdjustment?.items?.[0] || null;
    check(
      'Cycle Count reconcile created null-location adjustment item',
      reconcileItem && reconcileItem.locationId === null,
      reconcileAdjustment?.id || ''
    );

    const countMove = await StockMove.findOne({
      where: {
        companyId,
        refType: 'RW',
        refId: reconcileAdjustment?.id || null,
        type: 'adjustment',
      },
    });
    check('Cycle Count reconcile StockMove.fromLocationId is null', countMove && countMove.fromLocationId === null, countMove?.id || '');

    const finalLocationCount = await Location.count({ where: { companyId } });
    check('no Location rows were created during smoke', finalLocationCount === 0, `locations=${finalLocationCount}`);

    const inventoryRows = await InventoryItem.findAll({
      where: { companyId, productId: product.id },
      order: [['warehouseId', 'ASC']],
    });
    check(
      'all smoke InventoryItems have locationId null',
      inventoryRows.length === 2 && inventoryRows.every((row) => row.locationId === null),
      `rows=${inventoryRows.length}`
    );

    result = {
      status: results.every((row) => row.ok) ? 'PASS' : 'FAIL',
      generatedAt: new Date().toISOString(),
      credentials: { email, password },
      companyId,
      userId: user.id,
      warehouses: {
        mainWarehouseId: mainWarehouse.id,
        targetWarehouseId: targetWarehouse.id,
      },
      product: {
        productId: product.id,
        sku: product.sku,
      },
      documents: {
        receiptId: receipt.id,
        receiptItemId: receiptItem.id,
        shipmentId: shipment.id,
        shipmentItemId: shipmentItem.id,
        transferId: transfer.id,
        transferItemId: transferItem.id,
        pwId: pw.id,
        rwId: rw.id,
        cycleCountId: cycleCount.id,
        reconciledCycleCountId: reconciled.id,
        reconcileAdjustmentId: reconcileAdjustment?.id || null,
      },
      stockTimeline,
      moves: {
        pzMoveId: pzMove?.id || null,
        wzMoveId: wzMove?.id || null,
        mmMoveIds: mmMoves.map((move) => move.id),
        pwMoveId: pwMove?.id || null,
        rwMoveId: rwMove?.id || null,
        countMoveId: countMove?.id || null,
      },
      assertions: results,
    };

    const outputPath = await writeResultFile(result);
    // eslint-disable-next-line no-console
    console.log(`RESULT_FILE=${outputPath}`);
  } catch (error) {
    exitCode = 1;
    check('script execution', false, error && error.message);
    result = {
      status: 'FAIL',
      generatedAt: new Date().toISOString(),
      error: error && (error.stack || error.message),
      assertions: results,
    };
    try {
      const outputPath = await writeResultFile(result);
      // eslint-disable-next-line no-console
      console.log(`RESULT_FILE=${outputPath}`);
    } catch (_) {}
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    await sequelize.close();
  }

  const failed = results.filter((row) => !row.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(exitCode || (failed.length ? 1 : 0));
})();
