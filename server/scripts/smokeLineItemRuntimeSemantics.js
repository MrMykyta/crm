'use strict';

// A3 — runtime line-item semantics smoke.
// All writes are inside one rollback transaction.
//
// Run:
//   docker compose exec backend node scripts/smokeLineItemRuntimeSemantics.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Counterparty,
  Product,
  Warehouse,
  Location,
  Reservation,
  Shipment,
  ShipmentItem,
  StockMove,
  Offer,
  Order,
  OrderItem,
  OfferItem,
  InvoiceItem,
} = require('../src/models');
const receiptService = require('../src/services/wms/receiptService');
const orderService = require('../src/services/oms/orderService');
const offerService = require('../src/services/oms/offerService');
const invoiceService = require('../src/services/oms/invoiceService');
const Inventory = require('../src/services/wms/inventoryService');

const results = [];

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function createBase(t) {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const company = await Company.create({ name: `A3 Line Runtime ${suffix}` }, { transaction: t });
  const companyId = company.id;

  const warehouse = await Warehouse.create({
    id: crypto.randomUUID(),
    companyId,
    code: `A3-${suffix}`.slice(0, 32),
    name: 'A3 Warehouse',
    isActive: true,
  }, { transaction: t });
  const location = await Location.create({
    id: crypto.randomUUID(),
    companyId,
    warehouseId: warehouse.id,
    code: `BULK-${suffix}`.slice(0, 64),
    type: 'bulk',
  }, { transaction: t });
  await CompanyWarehouseDocumentSetting.create({
    companyId,
    defaultWarehouseId: warehouse.id,
    inventoryCostMethod: 'FIFO',
    costingInitializedAt: new Date(),
  }, { transaction: t });

  const counterparty = await Counterparty.create({
    id: crypto.randomUUID(),
    companyId,
    name: `A3 Counterparty ${suffix}`,
    shortName: `A3 CP ${suffix}`.slice(0, 120),
    type: 'client',
  }, { transaction: t });

  const tracked = await Product.create({
    id: crypto.randomUUID(),
    companyId,
    name: 'A3 tracked product',
    slug: `a3-tracked-${suffix}`,
    sku: `A3-T-${suffix}`.slice(0, 64),
    status: 'active',
    trackInventory: true,
    isService: false,
    price: 100,
    cost: 20,
    currency: 'PLN',
  }, { transaction: t });
  const service = await Product.create({
    id: crypto.randomUUID(),
    companyId,
    name: 'A3 service product',
    slug: `a3-service-${suffix}`,
    sku: `A3-S-${suffix}`.slice(0, 64),
    status: 'active',
    trackInventory: false,
    isService: true,
    price: 50,
    currency: 'PLN',
  }, { transaction: t });
  const nonStock = await Product.create({
    id: crypto.randomUUID(),
    companyId,
    name: 'A3 non-stock product',
    slug: `a3-nonstock-${suffix}`,
    sku: `A3-N-${suffix}`.slice(0, 64),
    status: 'active',
    trackInventory: false,
    isService: false,
    price: 25,
    currency: 'PLN',
  }, { transaction: t });

  return {
    companyId,
    warehouseId: warehouse.id,
    locationId: location.id,
    counterpartyId: counterparty.id,
    tracked,
    service,
    nonStock,
  };
}

async function receiveTrackedStock(base, t, qty = 10) {
  const receipt = await receiptService.create(
    base.companyId,
    {
      warehouseId: base.warehouseId,
      items: [{
        productId: base.tracked.id,
        qtyExpected: qty,
        unitCost: 20,
        currency: 'PLN',
      }],
    },
    t
  );
  await receiptService.receiveLine(
    base.companyId,
    receipt.items[0].id,
    { qty, toLocationId: base.locationId },
    t
  );
}

async function reservationQty(companyId, orderId, status, t) {
  const rows = await Reservation.findAll({ where: { companyId, orderId, status }, transaction: t });
  return rows.reduce((sum, row) => sum + n(row.qty), 0);
}

async function run() {
  await sequelize.authenticate();
  const t = await sequelize.transaction();

  try {
    const base = await createBase(t);
    const userContext = { companyId: base.companyId, id: null, transaction: t };

    await receiveTrackedStock(base, t, 10);

    const orderA = await orderService.createOrder({
      counterpartyId: base.counterpartyId,
      currencyCode: 'PLN',
      status: 'new',
      items: [
        { productId: base.tracked.id, quantity: 3, unitPriceNet: 100, taxRate: 23 },
        { productId: base.service.id, quantity: 1, unitPriceNet: 50, taxRate: 23 },
        { nameSnapshot: 'A3 custom line', quantity: 1, unitPriceNet: 10, taxRate: 0 },
      ],
    }, userContext, { transaction: t });

    const orderAItems = await OrderItem.findAll({
      where: { companyId: base.companyId, orderId: orderA.id },
      order: [['sortOrder', 'ASC']],
      transaction: t,
    });
    check('Scenario A: tracked/service/custom order has 3 lines', orderAItems.length === 3);
    check('Scenario A: tracked product line affects inventory',
      orderAItems[0].lineType === 'product' && orderAItems[0].affectsInventory === true);
    check('Scenario D: service product auto-derives lineType=service',
      orderAItems[1].lineType === 'service' && orderAItems[1].affectsInventory === false);
    check('Scenario A: custom line affectsInventory=false',
      orderAItems[2].lineType === 'custom' && orderAItems[2].affectsInventory === false);

    await orderService.changeOrderStatus(orderA.id, 'confirmed', {}, userContext, { transaction: t });
    check('Scenario A: reservation only for tracked line',
      await reservationQty(base.companyId, orderA.id, 'active', t) === 3);

    await orderService.changeOrderStatus(orderA.id, 'shipped', {}, userContext, { transaction: t });
    const shipmentA = await Shipment.findOne({
      where: { companyId: base.companyId, orderId: orderA.id },
      include: [{ model: ShipmentItem, as: 'items' }],
      transaction: t,
    });
    check('Scenario A: WZ created for tracked line order', Boolean(shipmentA?.id));
    check('Scenario A: WZ contains only tracked product line',
      shipmentA.items.length === 1 && shipmentA.items[0].productId === base.tracked.id);
    const onHandAfterShip = await Inventory.getOnHand({
      companyId: base.companyId,
      warehouseId: base.warehouseId,
      productId: base.tracked.id,
    }, { transaction: t });
    check('Scenario A: onHand reduced only for tracked product', n(onHandAfterShip) === 7);

    const invoiceA = await invoiceService.issue(orderA.id, { issueDate: new Date() }, { transaction: t });
    const invoiceAItems = await InvoiceItem.findAll({
      where: { companyId: base.companyId, invoiceId: invoiceA.id },
      order: [['sortOrder', 'ASC']],
      transaction: t,
    });
    check('Scenario A: invoice materializes all 3 line types', invoiceAItems.length === 3);

    const orderB = await orderService.createOrder({
      counterpartyId: base.counterpartyId,
      currencyCode: 'PLN',
      status: 'new',
      items: [
        { productId: base.nonStock.id, quantity: 1, unitPriceNet: 25, taxRate: 23 },
      ],
    }, userContext, { transaction: t });
    await orderService.changeOrderStatus(orderB.id, 'confirmed', {}, userContext, { transaction: t });
    await orderService.changeOrderStatus(orderB.id, 'shipped', {}, userContext, { transaction: t });
    const orderBReservations = await Reservation.count({
      where: { companyId: base.companyId, orderId: orderB.id },
      transaction: t,
    });
    const orderBShipments = await Shipment.count({
      where: { companyId: base.companyId, orderId: orderB.id },
      transaction: t,
    });
    check('Scenario B: non-stock product creates no reservations', orderBReservations === 0);
    check('Scenario B: non-stock product creates no WZ', orderBShipments === 0);
    const invoiceB = await invoiceService.issue(orderB.id, { issueDate: new Date() }, { transaction: t });
    check('Scenario B: invoice still contains non-stock line',
      await InvoiceItem.count({ where: { companyId: base.companyId, invoiceId: invoiceB.id }, transaction: t }) === 1);

    const offer = await offerService.createOffer({
      counterpartyId: base.counterpartyId,
      currency: 'PLN',
      status: 'draft',
      items: [
        { productId: base.tracked.id, quantity: 1, unitPriceNet: 100, taxRate: 23 },
        { productId: base.service.id, quantity: 1, unitPriceNet: 50, taxRate: 23 },
        { nameSnapshot: 'A3 offer custom', quantity: 1, unitPriceNet: 5, taxRate: 0 },
      ],
    }, userContext);
    await Offer.update(
      { status: 'accepted', acceptedAt: new Date() },
      { where: { id: offer.id, companyId: base.companyId }, transaction: t }
    );
    const sourceOfferItems = await OfferItem.findAll({
      where: { companyId: base.companyId, offerId: offer.id },
      order: [['sortOrder', 'ASC']],
      transaction: t,
    });
    const conversion = await offerService.convertOfferToOrder(offer.id, {}, userContext, { transaction: t });
    const convertedOrder = await Order.findByPk(conversion.order.id, { transaction: t });
    const convertedItems = await OrderItem.findAll({
      where: { companyId: base.companyId, orderId: convertedOrder.id },
      order: [['sortOrder', 'ASC']],
      transaction: t,
    });
    check('Scenario C: Offer→Order copies lineType snapshots',
      convertedItems.map((item) => item.lineType).join(',') === sourceOfferItems.map((item) => item.lineType).join(','));
    check('Scenario C: Offer→Order copies affectsInventory snapshots',
      convertedItems.map((item) => String(item.affectsInventory)).join(',')
        === sourceOfferItems.map((item) => String(item.affectsInventory)).join(','));
    check('Scenario C: Offer→Order copies isStockTrackedSnapshot snapshots',
      convertedItems.map((item) => String(item.isStockTrackedSnapshot)).join(',')
        === sourceOfferItems.map((item) => String(item.isStockTrackedSnapshot)).join(','));

    const invoiceSnapshot = invoiceAItems[0];
    await orderAItems[0].update({
      nameSnapshot: 'MUTATED ORDER ITEM',
      priceNet: 999,
      lineTotalGross: 999,
    }, { transaction: t });
    await base.tracked.update({
      name: 'MUTATED PRODUCT NAME',
      sku: 'MUTATED-SKU',
      status: 'archived',
    }, { transaction: t });
    const immutableReload = await InvoiceItem.findByPk(invoiceSnapshot.id, { transaction: t });
    check('Scenario E: InvoiceItem snapshot survives OrderItem mutation',
      immutableReload.nameSnapshot === invoiceSnapshot.nameSnapshot
        && n(immutableReload.priceNet) === n(invoiceSnapshot.priceNet)
        && n(immutableReload.lineTotalGross) === n(invoiceSnapshot.lineTotalGross));
    check('Scenario F: InvoiceItem snapshot survives product catalog mutation/archive',
      immutableReload.skuSnapshot === invoiceSnapshot.skuSnapshot
        && immutableReload.nameSnapshot !== 'MUTATED PRODUCT NAME');

    const failures = results.filter((result) => !result.ok);
    // eslint-disable-next-line no-console
    console.log(`SUMMARY: ${results.length - failures.length}/${results.length} checks passed`);
    if (failures.length) {
      throw new Error(`Smoke failed: ${failures.map((result) => result.name).join('; ')}`);
    }
  } finally {
    await t.rollback();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
