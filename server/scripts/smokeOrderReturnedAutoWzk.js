'use strict';

// K1.5 smoke — Order returned automatically creates WZK corrections for shipped WZ.
// NON-DESTRUCTIVE: all data is created inside one transaction and rolled back.
// Run:
//   docker compose exec backend node scripts/smokeOrderReturnedAutoWzk.js

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Counterparty,
  Location,
  Order,
  Product,
  Reservation,
  Shipment,
  StockMove,
  StockMoveCostAllocation,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const orderService = require('../src/services/oms/orderService');
const receiptService = require('../src/services/wms/receiptService');
const shipmentService = require('../src/services/wms/shipmentService');
const inventoryService = require('../src/services/wms/inventoryService');

const results = [];
const smokeCompanyIds = [];
function check(name, cond, extra = '') {
  const ok = Boolean(cond);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

function n(value) {
  return Number(value);
}

async function setupBase(t, label) {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const company = await Company.create({ name: `${label} ${suffix}` }, { transaction: t });
  const companyId = company.id;
  smokeCompanyIds.push(companyId);
  const warehouse = await Warehouse.create(
    { id: crypto.randomUUID(), companyId, code: `${label}-WH`.slice(0, 24), name: `${label} WH`, isActive: true },
    { transaction: t }
  );
  const location = await Location.create(
    { id: crypto.randomUUID(), companyId, warehouseId: warehouse.id, code: `${label}-A`.slice(0, 24), type: 'bulk' },
    { transaction: t }
  );
  await CompanyWarehouseDocumentSetting.create(
    {
      companyId,
      defaultWarehouseId: warehouse.id,
      inventoryCostMethod: 'FIFO',
      costingInitializedAt: new Date(),
    },
    { transaction: t }
  );
  const counterparty = await Counterparty.create(
    { id: crypto.randomUUID(), companyId, shortName: `${label} Customer`, type: 'client', status: 'active' },
    { transaction: t }
  );
  return { companyId, warehouse, location, counterparty, userContext: { companyId, userId: null, transaction: t } };
}

async function createProduct(companyId, t, label, cost = 20) {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return Product.create(
    {
      id: crypto.randomUUID(),
      companyId,
      name: `${label} Product`,
      slug: `${label.toLowerCase()}-${suffix}`,
      sku: `${label}-SKU`,
      cost,
      trackInventory: true,
      isService: false,
    },
    { transaction: t }
  );
}

async function postPz({ companyId, warehouseId, locationId, productId, qty, unitCost }, t) {
  const receipt = await receiptService.create(
    companyId,
    {
      warehouseId,
      items: [{ productId, qtyExpected: qty, unitCost, currency: 'PLN' }],
    },
    t
  );
  await receiptService.receiveLine(companyId, receipt.items[0].id, { qty, toLocationId: locationId }, t);
  return receiptService.getById(companyId, receipt.id, { transaction: t });
}

async function createProductOrder({ counterpartyId, productId, qty, userContext }, t) {
  return orderService.createOrder(
    {
      counterpartyId,
      currencyCode: 'PLN',
      status: 'new',
      items: [
        {
          productId,
          quantity: qty,
          unitPriceNet: 100,
          taxRate: 23,
        },
      ],
    },
    userContext,
    { transaction: t }
  );
}

async function createCustomOrder({ counterpartyId, userContext }, t) {
  return orderService.createOrder(
    {
      counterpartyId,
      currencyCode: 'PLN',
      status: 'new',
      items: [
        {
          nameSnapshot: 'Custom service line',
          quantity: 1,
          unitPriceNet: 100,
          taxRate: 23,
          isCustomLine: true,
        },
      ],
    },
    userContext,
    { transaction: t }
  );
}

async function getOnHand({ companyId, warehouseId, productId }, t) {
  return inventoryService.getOnHand(
    { companyId, warehouseId, productId, variantId: null },
    { transaction: t }
  );
}

async function getOriginalWz(companyId, orderId, t) {
  return Shipment.findOne({
    where: { companyId, orderId, parentDocumentId: null },
    order: [['createdAt', 'ASC']],
    transaction: t,
  });
}

async function countWzk(companyId, orderId, t) {
  return Shipment.count({
    where: { companyId, orderId, parentDocumentId: { [Op.ne]: null } },
    transaction: t,
  });
}

async function expectAppError(name, expectedCode, t, fn) {
  try {
    await sequelize.transaction({ transaction: t }, async (sp) => fn(sp));
    check(name, false, 'no error thrown');
  } catch (error) {
    check(
      name,
      error instanceof AppError && error.statusCode === 409 && error.code === expectedCode,
      `status=${error.statusCode} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    // A. paid -> returned: no WZ required, no WZK created.
    {
      const base = await setupBase(t, 'K15A');
      const order = await createCustomOrder({ counterpartyId: base.counterparty.id, userContext: base.userContext }, t);
      await orderService.changeOrderStatus(order.id, 'confirmed', {}, base.userContext, { transaction: t });
      await orderService.changeOrderStatus(order.id, 'paid', {}, base.userContext, { transaction: t });
      const returned = await orderService.changeOrderStatus(order.id, 'returned', {}, base.userContext, { transaction: t });
      const shipmentCount = await Shipment.count({ where: { companyId: base.companyId, orderId: order.id }, transaction: t });
      check('A paid -> returned allowed', returned.status === 'returned', `status=${returned.status}`);
      check('A paid -> returned creates no WZ/WZK', shipmentCount === 0, `shipments=${shipmentCount}`);
    }

    // B. shipped -> returned: WZK restores stock and reverses allocation.
    {
      const base = await setupBase(t, 'K15B');
      const product = await createProduct(base.companyId, t, 'K15B', 20);
      await postPz({ companyId: base.companyId, warehouseId: base.warehouse.id, locationId: base.location.id, productId: product.id, qty: 10, unitCost: 20 }, t);
      const order = await createProductOrder({ counterpartyId: base.counterparty.id, productId: product.id, qty: 4, userContext: base.userContext }, t);
      await orderService.changeOrderStatus(order.id, 'confirmed', {}, base.userContext, { transaction: t });
      await orderService.changeOrderStatus(order.id, 'shipped', {}, base.userContext, { transaction: t });
      const onHandAfterShip = await getOnHand({ companyId: base.companyId, warehouseId: base.warehouse.id, productId: product.id }, t);
      const wz = await getOriginalWz(base.companyId, order.id, t);
      const wzMove = await StockMove.findOne({ where: { companyId: base.companyId, refType: 'WZ', refId: wz.id, type: 'ship' }, transaction: t });
      const returned = await orderService.changeOrderStatus(order.id, 'returned', {}, base.userContext, { transaction: t });
      const onHandAfterReturn = await getOnHand({ companyId: base.companyId, warehouseId: base.warehouse.id, productId: product.id }, t);
      const wzReloaded = await Shipment.findByPk(wz.id, { transaction: t });
      const wzkCount = await countWzk(base.companyId, order.id, t);
      const alloc = await StockMoveCostAllocation.findOne({ where: { stockMoveId: wzMove.id }, transaction: t });
      check('B shipped -> onHand after ship = 6', n(onHandAfterShip) === 6, `onHand=${onHandAfterShip}`);
      check('B returned -> status returned', returned.status === 'returned', `status=${returned.status}`);
      check('B returned -> WZK count = 1', wzkCount === 1, `wzk=${wzkCount}`);
      check('B returned -> onHand restored to 10', n(onHandAfterReturn) === 10, `onHand=${onHandAfterReturn}`);
      check('B returned -> original WZ corrected', wzReloaded.status === 'corrected' && Boolean(wzReloaded.correctedById), `status=${wzReloaded.status} correctedBy=${wzReloaded.correctedById}`);
      check('B returned -> allocation reversed', alloc && alloc.reversedAt && alloc.reversedByStockMoveId, `reversedAt=${alloc && alloc.reversedAt}`);
    }

    // C + D. completed -> returned creates one WZK; repeat returned is no-op.
    {
      const base = await setupBase(t, 'K15C');
      const product = await createProduct(base.companyId, t, 'K15C', 20);
      await postPz({ companyId: base.companyId, warehouseId: base.warehouse.id, locationId: base.location.id, productId: product.id, qty: 10, unitCost: 20 }, t);
      const order = await createProductOrder({ counterpartyId: base.counterparty.id, productId: product.id, qty: 4, userContext: base.userContext }, t);
      await orderService.changeOrderStatus(order.id, 'confirmed', {}, base.userContext, { transaction: t });
      await orderService.changeOrderStatus(order.id, 'shipped', {}, base.userContext, { transaction: t });
      await orderService.changeOrderStatus(order.id, 'completed', {}, base.userContext, { transaction: t });
      const returned = await orderService.changeOrderStatus(order.id, 'returned', {}, base.userContext, { transaction: t });
      const wzkCountAfterReturn = await countWzk(base.companyId, order.id, t);
      const repeated = await orderService.changeOrderStatus(order.id, 'returned', {}, base.userContext, { transaction: t });
      const wzkCountAfterRepeat = await countWzk(base.companyId, order.id, t);
      check('C completed -> returned status returned', returned.status === 'returned', `status=${returned.status}`);
      check('C completed -> returned creates one WZK', wzkCountAfterReturn === 1, `wzk=${wzkCountAfterReturn}`);
      check('D repeated returned stays returned', repeated.status === 'returned', `status=${repeated.status}`);
      check('D repeated returned creates no second WZK', wzkCountAfterRepeat === 1, `wzk=${wzkCountAfterRepeat}`);
    }

    // E. multiple WZ for one order -> WZK for each uncorrected shipped WZ.
    {
      const base = await setupBase(t, 'K15E');
      const product = await createProduct(base.companyId, t, 'K15E', 20);
      await postPz({ companyId: base.companyId, warehouseId: base.warehouse.id, locationId: base.location.id, productId: product.id, qty: 20, unitCost: 20 }, t);
      const order = await createProductOrder({ counterpartyId: base.counterparty.id, productId: product.id, qty: 4, userContext: base.userContext }, t);
      await orderService.changeOrderStatus(order.id, 'confirmed', {}, base.userContext, { transaction: t });
      await orderService.changeOrderStatus(order.id, 'shipped', {}, base.userContext, { transaction: t });
      const extraWz = await shipmentService.create(
        base.companyId,
        { orderId: order.id, warehouseId: base.warehouse.id, items: [{ productId: product.id, qty: 2 }] },
        t
      );
      await shipmentService.shipItem(base.companyId, extraWz.items[0].id, { qty: 2, fromLocationId: base.location.id }, t);
      const onHandBeforeReturn = await getOnHand({ companyId: base.companyId, warehouseId: base.warehouse.id, productId: product.id }, t);
      await orderService.changeOrderStatus(order.id, 'returned', {}, base.userContext, { transaction: t });
      const wzkCount = await countWzk(base.companyId, order.id, t);
      const correctedOriginals = await Shipment.count({ where: { companyId: base.companyId, orderId: order.id, parentDocumentId: null, status: 'corrected' }, transaction: t });
      const onHandAfterReturn = await getOnHand({ companyId: base.companyId, warehouseId: base.warehouse.id, productId: product.id }, t);
      check('E multiple WZ -> pre-return onHand = 14', n(onHandBeforeReturn) === 14, `onHand=${onHandBeforeReturn}`);
      check('E multiple WZ -> creates 2 WZK', wzkCount === 2, `wzk=${wzkCount}`);
      check('E multiple WZ -> both original WZ corrected', correctedOriginals === 2, `corrected=${correctedOriginals}`);
      check('E multiple WZ -> onHand restored to 20', n(onHandAfterReturn) === 20, `onHand=${onHandAfterReturn}`);
    }

    // F. shipped without shipment -> 409 ORDER_RETURN_SHIPMENT_NOT_FOUND.
    {
      const base = await setupBase(t, 'K15F');
      const order = await createCustomOrder({ counterpartyId: base.counterparty.id, userContext: base.userContext }, t);
      await Order.update({ status: 'shipped' }, { where: { id: order.id, companyId: base.companyId }, transaction: t });
      await expectAppError(
        'F shipped/completed without WZ -> 409 ORDER_RETURN_SHIPMENT_NOT_FOUND',
        'ORDER_RETURN_SHIPMENT_NOT_FOUND',
        t,
        (sp) => orderService.changeOrderStatus(order.id, 'returned', {}, { ...base.userContext, transaction: sp }, { transaction: sp })
      );
    }

    // Sanity: no active reservations remain for returned orders created in this smoke.
    const activeReservations = await Reservation.count({
      where: { companyId: smokeCompanyIds, status: 'active' },
      transaction: t,
    });
    check('sanity: no active reservations left in transaction', activeReservations === 0, `active=${activeReservations}`);
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
