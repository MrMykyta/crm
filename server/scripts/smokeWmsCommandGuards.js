'use strict';

// Backend WMS command guard smoke.
// NON-DESTRUCTIVE: all operations run inside one transaction and are always rolled back.

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Location,
  Product,
  Receipt,
  Shipment,
  TransferItem,
  TransferOrder,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const adjustmentService = require('../src/services/wms/adjustmentService');
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const transferService = require('../src/services/wms/transferService');

const results = [];

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
      error instanceof AppError && error.code === expectedCode,
      `status=${error.statusCode} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

async function createProduct(companyId, sku, t) {
  return Product.create(
    {
      id: crypto.randomUUID(),
      companyId,
      name: `${sku} Product`,
      slug: `${sku.toLowerCase()}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
      sku,
      cost: 20,
      currency: 'PLN',
    },
    { transaction: t }
  );
}

async function createReceipt(companyId, warehouseId, productId, qty, t) {
  return receiptService.create(
    companyId,
    {
      warehouseId,
      items: [{ productId, variantId: null, qtyExpected: qty, unitCost: 20, currency: 'PLN' }],
    },
    t
  );
}

async function receiveReceipt(companyId, receipt, locationId, t) {
  await receiptService.receiveLine(
    companyId,
    receipt.items[0].id,
    { qty: Number(receipt.items[0].qtyExpected), toLocationId: locationId },
    t
  );
  return Receipt.findByPk(receipt.id, { transaction: t });
}

async function createShipment(companyId, warehouseId, productId, qty, t) {
  return shipmentService.create(
    companyId,
    {
      warehouseId,
      items: [{ productId, variantId: null, qty }],
    },
    t
  );
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `WMS Command Guards ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouseA = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'GUARD-A', name: 'Guard A', isActive: true },
      { transaction: t }
    );
    const warehouseB = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'GUARD-B', name: 'Guard B', isActive: true },
      { transaction: t }
    );
    const locationA = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: warehouseA.id, code: 'GUARD-A-1', type: 'bulk' },
      { transaction: t }
    );
    const locationB = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: warehouseB.id, code: 'GUARD-B-1', type: 'bulk' },
      { transaction: t }
    );

    const pzProduct = await createProduct(companyId, 'GUARD-PZ', t);
    const pzDraft = await createReceipt(companyId, warehouseA.id, pzProduct.id, 5, t);
    await receiptService.receiveLine(
      companyId,
      pzDraft.items[0].id,
      { qty: 5, toLocationId: locationA.id },
      t
    );
    const pzReceived = await Receipt.findByPk(pzDraft.id, { transaction: t });
    check('PZ draft receive allowed and transitions to received', pzReceived.status === 'received', `status=${pzReceived.status}`);

    await expectAppError(
      'PZ received receive rejected',
      'RECEIPT_NOT_DRAFT',
      () => receiptService.receiveLine(companyId, pzDraft.items[0].id, { qty: 1, toLocationId: locationA.id }, t)
    );

    const pzCorrectionProduct = await createProduct(companyId, 'GUARD-PZK', t);
    const pzForCorrection = await createReceipt(companyId, warehouseA.id, pzCorrectionProduct.id, 4, t);
    await receiveReceipt(companyId, pzForCorrection, locationA.id, t);
    const pzk = await receiptService.createReceiptCorrection(
      companyId,
      pzForCorrection.id,
      { items: [{ originalItemId: pzForCorrection.items[0].id, qty: 4 }] },
      { transaction: t }
    );
    await expectAppError(
      'PZK receive rejected',
      'CORRECTION_DOCUMENT_IMMUTABLE',
      () => receiptService.receiveLine(companyId, pzk.items[0].id, { qty: 1, toLocationId: locationA.id }, t)
    );

    const pzDraftCorrection = await createReceipt(companyId, warehouseA.id, pzProduct.id, 2, t);
    await expectAppError(
      'PZ draft correction rejected',
      'RECEIPT_NOT_CORRECTABLE',
      () => receiptService.createReceiptCorrection(
        companyId,
        pzDraftCorrection.id,
        { items: [{ originalItemId: pzDraftCorrection.items[0].id, qty: 2 }] },
        { transaction: t }
      )
    );

    const pzCorrectionAllowedProduct = await createProduct(companyId, 'GUARD-PZ-OK', t);
    const pzCorrectionAllowed = await createReceipt(companyId, warehouseA.id, pzCorrectionAllowedProduct.id, 3, t);
    await receiveReceipt(companyId, pzCorrectionAllowed, locationA.id, t);
    const pzkAllowed = await receiptService.createReceiptCorrection(
      companyId,
      pzCorrectionAllowed.id,
      { items: [{ originalItemId: pzCorrectionAllowed.items[0].id, qty: 3 }] },
      { transaction: t }
    );
    check('PZ received correction allowed', pzkAllowed && pzkAllowed.parentDocumentId === pzCorrectionAllowed.id);
    await expectAppError(
      'PZ second correction rejected',
      'DOCUMENT_ALREADY_CORRECTED',
      () => receiptService.createReceiptCorrection(
        companyId,
        pzCorrectionAllowed.id,
        { items: [{ originalItemId: pzCorrectionAllowed.items[0].id, qty: 1 }] },
        { transaction: t }
      )
    );

    const wzProduct = await createProduct(companyId, 'GUARD-WZ', t);
    const wzStock = await createReceipt(companyId, warehouseA.id, wzProduct.id, 10, t);
    await receiveReceipt(companyId, wzStock, locationA.id, t);
    const wzPacking = await createShipment(companyId, warehouseA.id, wzProduct.id, 4, t);
    await shipmentService.shipItem(companyId, wzPacking.items[0].id, { qty: 4, fromLocationId: locationA.id }, t);
    const wzShipped = await Shipment.findByPk(wzPacking.id, { transaction: t });
    check('WZ packing ship allowed and transitions to shipped', wzShipped.status === 'shipped', `status=${wzShipped.status}`);

    const wzk = await shipmentService.createShipmentCorrection(
      companyId,
      wzPacking.id,
      { items: [{ originalItemId: wzPacking.items[0].id, qty: 4 }] },
      { transaction: t }
    );
    check('WZ shipped correction allowed', wzk && wzk.parentDocumentId === wzPacking.id);
    await expectAppError(
      'WZK ship rejected',
      'CORRECTION_DOCUMENT_IMMUTABLE',
      () => shipmentService.shipItem(companyId, wzk.items[0].id, { qty: 1, fromLocationId: locationA.id }, t)
    );

    const wzPackingCorrection = await createShipment(companyId, warehouseA.id, wzProduct.id, 1, t);
    await expectAppError(
      'WZ packing correction rejected',
      'SHIPMENT_NOT_SHIPPED',
      () => shipmentService.createShipmentCorrection(
        companyId,
        wzPackingCorrection.id,
        { items: [{ originalItemId: wzPackingCorrection.items[0].id, qty: 1 }] },
        { transaction: t }
      )
    );

    const mmProduct = await createProduct(companyId, 'GUARD-MM', t);
    const mmStock = await createReceipt(companyId, warehouseA.id, mmProduct.id, 5, t);
    await receiveReceipt(companyId, mmStock, locationA.id, t);
    const transfer = await transferService.create(
      companyId,
      {
        fromWarehouseId: warehouseA.id,
        toWarehouseId: warehouseB.id,
        items: [{ productId: mmProduct.id, variantId: null, qty: 5 }],
      },
      t
    );
    const transferItem = await TransferItem.findOne({ where: { transferId: transfer.id }, transaction: t });
    await transferService.executeLine(
      companyId,
      transferItem.id,
      { qty: 2, fromLocationId: locationA.id, toLocationId: locationB.id },
      t
    );
    const transferInTransit = await TransferOrder.findByPk(transfer.id, { transaction: t });
    check('MM execute draft allowed and transitions to in_transit', transferInTransit.status === 'in_transit', `status=${transferInTransit.status}`);
    await transferService.executeLine(
      companyId,
      transferItem.id,
      { qty: 3, fromLocationId: locationA.id, toLocationId: locationB.id },
      t
    );
    const transferReceived = await TransferOrder.findByPk(transfer.id, { transaction: t });
    check('MM fully executed transitions to received', transferReceived.status === 'received', `status=${transferReceived.status}`);
    await expectAppError(
      'MM received execute rejected',
      'TRANSFER_NOT_EXECUTABLE',
      () => transferService.executeLine(
        companyId,
        transferItem.id,
        { qty: 1, fromLocationId: locationA.id, toLocationId: locationB.id },
        t
      )
    );

    const missingLocationTransfer = await transferService.create(
      companyId,
      {
        fromWarehouseId: warehouseA.id,
        toWarehouseId: warehouseB.id,
        items: [{ productId: mmProduct.id, variantId: null, qty: 1 }],
      },
      t
    );
    const missingLocationItem = await TransferItem.findOne({ where: { transferId: missingLocationTransfer.id }, transaction: t });
    await expectAppError(
      'MM execute without required locations rejected',
      'TRANSFER_LOCATION_REQUIRED',
      () => transferService.executeLine(companyId, missingLocationItem.id, { qty: 1 }, t)
    );

    const pw = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'PW',
        items: [{ productId: pzProduct.id, locationId: locationA.id, qtyDelta: 2 }],
      },
      t
    );
    const pwPosted = await adjustmentService.post(companyId, pw.id, t);
    check('PW draft post allowed', pwPosted.status === 'posted', `status=${pwPosted.status}`);
    const pwRepeat = await adjustmentService.post(companyId, pw.id, t);
    check('PW posted post remains idempotent', pwRepeat.status === 'posted', `status=${pwRepeat.status}`);

    const rw = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'RW',
        items: [{ productId: pzProduct.id, locationId: locationA.id, qtyDelta: -1 }],
      },
      t
    );
    const rwPosted = await adjustmentService.post(companyId, rw.id, t);
    check('RW draft post allowed', rwPosted.status === 'posted', `status=${rwPosted.status}`);
    const rwRepeat = await adjustmentService.post(companyId, rw.id, t);
    check('RW posted post remains idempotent', rwRepeat.status === 'posted', `status=${rwRepeat.status}`);
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
