'use strict';

// Standalone runtime smoke for Orders -> reservations -> WZ integration (B3/C1/C2).
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
// Run in backend container:
//   docker compose exec backend node scripts/smokeOrdersReservationsWz.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Warehouse,
  Location,
  Product,
  Counterparty,
  CompanyWarehouseDocumentSetting,
  Reservation,
  Shipment,
} = require('../src/models');

const inventoryService = require('../src/services/wms/inventoryService');
const orderService = require('../src/services/oms/orderService');

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

    const company = await Company.create({ name: 'Orders Reservations WZ Smoke' }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'ORD-WH',
        name: 'Orders WH',
        isActive: true,
      },
      { transaction: t }
    );

    const location = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'ORD-A',
        type: 'bulk',
      },
      { transaction: t }
    );

    await CompanyWarehouseDocumentSetting.create(
      {
        companyId,
        defaultWarehouseId: warehouse.id,
      },
      { transaction: t }
    );

    const productA = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'ORD Product A',
        slug: `ord-product-a-${Date.now()}`,
        sku: 'ORD-A',
      },
      { transaction: t }
    );

    const productB = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'ORD Product B',
        slug: `ord-product-b-${Date.now()}`,
        sku: 'ORD-B',
      },
      { transaction: t }
    );

    const counterparty = await Counterparty.create(
      {
        id: crypto.randomUUID(),
        companyId,
        shortName: 'Smoke Counterparty',
        type: 'client',
        status: 'active',
      },
      { transaction: t }
    );

    const userContext = { companyId, userId: null, transaction: t };

    // PZ 10 (via stock move receipt)
    await inventoryService.applyMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: location.id,
        productId: productA.id,
        variantId: null,
        qty: 10,
        refType: 'PZ',
        refId: crypto.randomUUID(),
        refItemId: crypto.randomUUID(),
      },
      { transaction: t }
    );

    // order on 3
    const order = await orderService.createOrder(
      {
        counterpartyId: counterparty.id,
        currencyCode: 'PLN',
        status: 'new',
        items: [
          {
            productId: productA.id,
            quantity: 3,
            unitPriceNet: 100,
            taxRate: 23,
          },
        ],
      },
      userContext,
      { transaction: t }
    );

    const confirmed = await orderService.changeOrderStatus(order.id, 'confirmed', {}, userContext, { transaction: t });
    check('confirmed status applied', confirmed.status === 'confirmed', `status=${confirmed.status}`);

    const reservedAfterConfirm = await inventoryService.getReserved(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: productA.id,
        variantId: null,
      },
      { transaction: t }
    );
    const availableAfterConfirm = await inventoryService.getAvailable(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: productA.id,
        variantId: null,
      },
      { transaction: t }
    );
    check('confirmed -> reserved = 3', Number(reservedAfterConfirm) === 3, `reserved=${reservedAfterConfirm}`);
    check('confirmed -> available = 7', Number(availableAfterConfirm) === 7, `available=${availableAfterConfirm}`);

    const shipped = await orderService.changeOrderStatus(order.id, 'shipped', {}, userContext, { transaction: t });
    check('shipped status applied', shipped.status === 'shipped', `status=${shipped.status}`);

    const onHandAfterShip = await inventoryService.getOnHand(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: productA.id,
        variantId: null,
      },
      { transaction: t }
    );
    check('shipped -> onHand = 7', Number(onHandAfterShip) === 7, `onHand=${onHandAfterShip}`);

    const activeReservationsAfterShip = await Reservation.count({
      where: { companyId, orderId: order.id, status: 'active' },
      transaction: t,
    });
    const fulfilledReservationsAfterShip = await Reservation.count({
      where: { companyId, orderId: order.id, status: 'fulfilled' },
      transaction: t,
    });
    check('shipped -> no active reservations', activeReservationsAfterShip === 0, `active=${activeReservationsAfterShip}`);
    check('shipped -> reservation fulfilled', fulfilledReservationsAfterShip > 0, `fulfilled=${fulfilledReservationsAfterShip}`);

    const shipmentCountAfterShip = await Shipment.count({ where: { companyId, orderId: order.id }, transaction: t });

    const completed = await orderService.changeOrderStatus(order.id, 'completed', {}, userContext, { transaction: t });
    check('completed status applied', completed.status === 'completed', `status=${completed.status}`);

    const onHandAfterCompleted = await inventoryService.getOnHand(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: productA.id,
        variantId: null,
      },
      { transaction: t }
    );
    const shipmentCountAfterCompleted = await Shipment.count({ where: { companyId, orderId: order.id }, transaction: t });
    check('completed after shipped does not change onHand', Number(onHandAfterCompleted) === 7, `onHand=${onHandAfterCompleted}`);
    check('completed after shipped does not create extra WZ', shipmentCountAfterCompleted === shipmentCountAfterShip, `before=${shipmentCountAfterShip}, after=${shipmentCountAfterCompleted}`);

    const orderToCancel = await orderService.createOrder(
      {
        counterpartyId: counterparty.id,
        currencyCode: 'PLN',
        status: 'new',
        items: [
          {
            productId: productA.id,
            quantity: 2,
            unitPriceNet: 50,
            taxRate: 23,
          },
        ],
      },
      userContext,
      { transaction: t }
    );

    await orderService.changeOrderStatus(orderToCancel.id, 'confirmed', {}, userContext, { transaction: t });
    const reservedBeforeCancel = await Reservation.count({
      where: { companyId, orderId: orderToCancel.id, status: 'active' },
      transaction: t,
    });
    check('cancel test: active reservations created on confirm', reservedBeforeCancel === 1, `active=${reservedBeforeCancel}`);

    await orderService.changeOrderStatus(orderToCancel.id, 'cancelled', {}, userContext, { transaction: t });
    const activeAfterCancel = await Reservation.count({
      where: { companyId, orderId: orderToCancel.id, status: 'active' },
      transaction: t,
    });
    const cancelledAfterCancel = await Reservation.count({
      where: { companyId, orderId: orderToCancel.id, status: 'cancelled' },
      transaction: t,
    });
    check('cancelled before shipped -> release active reservations', activeAfterCancel === 0, `active=${activeAfterCancel}`);
    check('cancelled before shipped -> reservations marked cancelled', cancelledAfterCancel === 1, `cancelled=${cancelledAfterCancel}`);

    // Hard mode: one insufficient line -> full confirm rollback, deficit details present.
    const deficitOrder = await orderService.createOrder(
      {
        counterpartyId: counterparty.id,
        currencyCode: 'PLN',
        status: 'new',
        items: [
          {
            productId: productA.id,
            quantity: 1,
            unitPriceNet: 10,
            taxRate: 23,
          },
          {
            productId: productB.id,
            quantity: 5,
            unitPriceNet: 10,
            taxRate: 23,
          },
        ],
      },
      userContext,
      { transaction: t }
    );

    let deficitError = null;
    try {
      await orderService.changeOrderStatus(deficitOrder.id, 'confirmed', {}, userContext, { transaction: t });
    } catch (error) {
      deficitError = error;
    }

    check('hard mode -> insufficient line returns 409', deficitError?.statusCode === 409, `status=${deficitError?.statusCode}`);
    check('hard mode -> deficit details returned', Array.isArray(deficitError?.details?.deficits) && deficitError.details.deficits.length > 0);

    const deficitOrderActiveReservations = await Reservation.count({
      where: { companyId, orderId: deficitOrder.id, status: 'active' },
      transaction: t,
    });
    check('hard mode -> confirm rollback, no active reservations created', deficitOrderActiveReservations === 0, `active=${deficitOrderActiveReservations}`);
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
