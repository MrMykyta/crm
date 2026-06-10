'use strict';

// WMS detail/history DTO enrichment smoke.
// NON-DESTRUCTIVE: all operations run inside one transaction and are always rolled back.

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Counterparty,
  Location,
  Order,
  Product,
  ProductVariant,
  TransferItem,
  Warehouse,
} = require('../src/models');
const adjustmentService = require('../src/services/wms/adjustmentService');
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const transferService = require('../src/services/wms/transferService');
const transferOrderService = require('../src/services/wms/transferOrderService');
const inventoryCountService = require('../src/services/wms/inventoryCountService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

function hasSummary(value, fields) {
  return value && fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();
    const company = await Company.create({ name: `WMS DTO Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;
    await CompanyWarehouseDocumentSetting.create(
      { companyId, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );

    const warehouseA = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'DTO-A', name: 'DTO Warehouse A', isActive: true },
      { transaction: t }
    );
    const warehouseB = await Warehouse.create(
      { id: crypto.randomUUID(), companyId, code: 'DTO-B', name: 'DTO Warehouse B', isActive: true },
      { transaction: t }
    );
    const locationA = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: warehouseA.id, code: 'DTO-A-1', type: 'bulk' },
      { transaction: t }
    );
    const locationB = await Location.create(
      { id: crypto.randomUUID(), companyId, warehouseId: warehouseB.id, code: 'DTO-B-1', type: 'staging' },
      { transaction: t }
    );
    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'DTO Product',
        slug: `dto-product-${suffix}`,
        sku: 'DTO-SKU',
        cost: 12,
        currency: 'PLN',
      },
      { transaction: t }
    );
    const variant = await ProductVariant.create(
      {
        id: crypto.randomUUID(),
        companyId,
        productId: product.id,
        sku: 'DTO-VAR',
        cost: 12,
        currency: 'PLN',
      },
      { transaction: t }
    );

    const receipt = await receiptService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        inboundLocationId: locationA.id,
        items: [{ productId: product.id, variantId: variant.id, qtyExpected: 10, unitCost: 12, currency: 'PLN' }],
      },
      t
    );
    check('Receipt detail keeps warehouseId and adds warehouse summary',
      receipt.warehouseId === warehouseA.id && hasSummary(receipt.warehouse, ['id', 'code', 'name']),
      `warehouse=${JSON.stringify(receipt.warehouse)}`);
    check('Receipt detail adds inboundLocation summary',
      receipt.inboundLocationId === locationA.id && hasSummary(receipt.inboundLocation, ['id', 'code', 'name']),
      `location=${JSON.stringify(receipt.inboundLocation)}`);
    check('Receipt item adds product and variant summaries',
      hasSummary(receipt.items?.[0]?.product, ['id', 'sku', 'name'])
        && hasSummary(receipt.items?.[0]?.variant, ['id', 'sku', 'name']),
      `product=${JSON.stringify(receipt.items?.[0]?.product)} variant=${JSON.stringify(receipt.items?.[0]?.variant)}`);

    await receiptService.receiveLine(companyId, receipt.items[0].id, { qty: 10, toLocationId: locationA.id }, t);
    const receiptHistory = await receiptService.listStockMoves(companyId, receipt.id, { page: 1, limit: 20 }, { transaction: t });
    check('Receipt stock move history adds product/warehouse/toLocation summaries',
      hasSummary(receiptHistory.rows?.[0]?.product, ['id', 'sku', 'name'])
        && hasSummary(receiptHistory.rows?.[0]?.warehouse, ['id', 'code', 'name'])
        && hasSummary(receiptHistory.rows?.[0]?.toLocation, ['id', 'code', 'name']),
      `move=${JSON.stringify(receiptHistory.rows?.[0])}`);

    const counterparty = await Counterparty.create(
      { companyId, shortName: 'DTO Customer', fullName: 'DTO Customer', type: 'client', status: 'active' },
      { transaction: t }
    );
    const order = await Order.create(
      {
        companyId,
        customerId: counterparty.id,
        number: `ORD-DTO-${suffix}`,
        currencyCode: 'PLN',
        status: 'confirmed',
      },
      { transaction: t }
    );
    const shipment = await shipmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        orderId: order.id,
        items: [{ productId: product.id, variantId: variant.id, qty: 2 }],
      },
      t
    );
    check('Shipment detail adds warehouse and order summaries',
      hasSummary(shipment.warehouse, ['id', 'code', 'name'])
        && hasSummary(shipment.order, ['id', 'number', 'status']),
      `warehouse=${JSON.stringify(shipment.warehouse)} order=${JSON.stringify(shipment.order)}`);
    check('Shipment item adds product and variant summaries',
      hasSummary(shipment.items?.[0]?.product, ['id', 'sku', 'name'])
        && hasSummary(shipment.items?.[0]?.variant, ['id', 'sku', 'name']));

    const transfer = await transferService.create(
      companyId,
      {
        fromWarehouseId: warehouseA.id,
        toWarehouseId: warehouseB.id,
        items: [{ productId: product.id, variantId: variant.id, qty: 3 }],
      },
      t
    );
    const transferItem = await TransferItem.findOne({ where: { transferId: transfer.id }, transaction: t });
    await transferService.executeLine(
      companyId,
      transferItem.id,
      { qty: 3, fromLocationId: locationA.id, toLocationId: locationB.id },
      t
    );
    const transferDetail = await transferOrderService.getById(transfer.id, companyId, { transaction: t });
    check('Transfer detail adds source/target warehouse summaries',
      hasSummary(transferDetail.sourceWarehouse, ['id', 'code', 'name'])
        && hasSummary(transferDetail.targetWarehouse, ['id', 'code', 'name']),
      `source=${JSON.stringify(transferDetail.sourceWarehouse)} target=${JSON.stringify(transferDetail.targetWarehouse)}`);
    check('Transfer detail derives source/target location summaries from stock moves',
      transferDetail.sourceLocationId === locationA.id
        && transferDetail.targetLocationId === locationB.id
        && hasSummary(transferDetail.sourceLocation, ['id', 'code', 'name'])
        && hasSummary(transferDetail.targetLocation, ['id', 'code', 'name']),
      `sourceLocation=${JSON.stringify(transferDetail.sourceLocation)} targetLocation=${JSON.stringify(transferDetail.targetLocation)}`);
    check('Transfer item adds product and variant summaries',
      hasSummary(transferDetail.items?.[0]?.product, ['id', 'sku', 'name'])
        && hasSummary(transferDetail.items?.[0]?.variant, ['id', 'sku', 'name']));

    const adjustment = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouseA.id,
        documentType: 'PW',
        items: [{ productId: product.id, variantId: variant.id, locationId: locationA.id, qtyDelta: 1, unitCost: 12 }],
      },
      t
    );
    check('Adjustment detail adds warehouse summary',
      hasSummary(adjustment.warehouse, ['id', 'code', 'name']),
      `warehouse=${JSON.stringify(adjustment.warehouse)}`);
    check('Adjustment item adds location/product/variant summaries',
      hasSummary(adjustment.items?.[0]?.location, ['id', 'code', 'name'])
        && hasSummary(adjustment.items?.[0]?.product, ['id', 'sku', 'name'])
        && hasSummary(adjustment.items?.[0]?.variant, ['id', 'sku', 'name']),
      `item=${JSON.stringify(adjustment.items?.[0])}`);

    const cycleCount = await inventoryCountService.createCycleCount(
      companyId,
      {
        warehouseId: warehouseA.id,
        items: [{ locationId: locationA.id, productId: product.id, variantId: variant.id, qtyCounted: 1 }],
      },
      { transaction: t }
    );
    check('Cycle count detail adds warehouse summary',
      hasSummary(cycleCount.warehouse, ['id', 'code', 'name']),
      `warehouse=${JSON.stringify(cycleCount.warehouse)}`);
    check('Cycle count item adds location/product/variant summaries',
      hasSummary(cycleCount.items?.[0]?.location, ['id', 'code', 'name'])
        && hasSummary(cycleCount.items?.[0]?.product, ['id', 'sku', 'name'])
        && hasSummary(cycleCount.items?.[0]?.variant, ['id', 'sku', 'name']),
      `item=${JSON.stringify(cycleCount.items?.[0])}`);
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
