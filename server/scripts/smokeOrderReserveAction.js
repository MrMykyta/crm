'use strict';

const crypto = require('crypto');
const {
  sequelize,
  Company,
  User,
  UserCompany,
  Counterparty,
  Product,
  Warehouse,
  InventoryItem,
  Reservation,
  CompanyWarehouseDocumentSetting,
} = require('../src/models');
const orderService = require('../src/services/oms/orderService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function qty(value) {
  return Number(Number(value || 0).toFixed(4));
}

function getErrorCode(error) {
  return error?.code || error?.details?.code || error?.response?.data?.code || error?.message;
}

async function expectReserveError(name, orderId, expectedCode, ctx) {
  try {
    await orderService.reserveOrderStock(orderId, {}, ctx, { transaction: ctx.transaction });
    check(name, false, 'reserve succeeded unexpectedly');
  } catch (error) {
    check(name, getErrorCode(error) === expectedCode, `code=${getErrorCode(error)}`);
  }
}

async function activeReservationCount(companyId, orderId, transaction) {
  return Reservation.count({
    where: { companyId, orderId, status: 'active' },
    transaction,
  });
}

async function createProduct({ companyId, suffix, code, trackInventory = true, isService = false, transaction }) {
  return Product.create({
    id: crypto.randomUUID(),
    companyId,
    name: `${isService ? 'Service' : 'Stock'} ${code} ${suffix}`,
    slug: `${isService ? 'service' : 'stock'}-${code}-${suffix}`.toLowerCase(),
    sku: `${code}-${suffix}`.slice(0, 64),
    status: 'active',
    currency: 'PLN',
    price: 100,
    trackInventory,
    isService,
  }, { transaction });
}

async function createInventory({ companyId, warehouseId, productId, qtyOnHand, transaction }) {
  return InventoryItem.create({
    id: crypto.randomUUID(),
    companyId,
    warehouseId,
    productId,
    variantId: null,
    qtyOnHand,
    qtyReserved: 0,
  }, { transaction });
}

async function createOrder({ suffix, companyId, ownerId, counterpartyId, items, transaction }) {
  const ctx = { id: ownerId, userId: ownerId, companyId, transaction };
  const order = await orderService.createOrder({
    number: `RSV-${suffix}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
    counterpartyId,
    ownerId,
    currencyCode: 'PLN',
    status: 'new',
    items,
  }, ctx, { transaction });
  return orderService.getOrderById(order.id, ctx);
}

(async () => {
  let tx;
  try {
    await sequelize.authenticate();
    tx = await sequelize.transaction();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await User.create({
      id: crypto.randomUUID(),
      email: `oms-reserve-action-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: tx });

    const company = await Company.create({
      id: crypto.randomUUID(),
      name: `OMS Reserve Action Smoke ${suffix}`,
      ownerUserId: owner.id,
    }, { transaction: tx });

    await UserCompany.create({
      id: crypto.randomUUID(),
      userId: owner.id,
      companyId: company.id,
      role: 'owner',
      status: 'active',
    }, { transaction: tx });

    const counterparty = await Counterparty.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      shortName: `Reserve Customer ${suffix}`.slice(0, 120),
      fullName: `Reserve Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
    }, { transaction: tx });

    const warehouseA = await Warehouse.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      code: `RSA-${String(Date.now()).slice(-6)}`,
      name: 'Reserve Warehouse A',
      isActive: true,
    }, { transaction: tx });
    const warehouseB = await Warehouse.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      code: `RSB-${String(Date.now()).slice(-6)}`,
      name: 'Reserve Warehouse B',
      isActive: true,
    }, { transaction: tx });

    await CompanyWarehouseDocumentSetting.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      defaultWarehouseId: warehouseA.id,
    }, { transaction: tx });

    const available = await createProduct({ companyId: company.id, suffix, code: 'READY', transaction: tx });
    const shortage = await createProduct({ companyId: company.id, suffix, code: 'SHORT', transaction: tx });
    const splitOne = await createProduct({ companyId: company.id, suffix, code: 'SPLITA', transaction: tx });
    const splitTwo = await createProduct({ companyId: company.id, suffix, code: 'SPLITB', transaction: tx });
    const service = await createProduct({
      companyId: company.id,
      suffix,
      code: 'SERV',
      trackInventory: false,
      isService: true,
      transaction: tx,
    });

    await Promise.all([
      createInventory({ companyId: company.id, warehouseId: warehouseA.id, productId: available.id, qtyOnHand: 20, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseA.id, productId: shortage.id, qtyOnHand: 1, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseA.id, productId: splitOne.id, qtyOnHand: 5, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseB.id, productId: splitTwo.id, qtyOnHand: 5, transaction: tx }),
    ]);

    const ctx = { id: owner.id, userId: owner.id, companyId: company.id, transaction: tx };

    const availableOrder = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [{ productId: available.id, quantity: 3, unitPriceNet: 100, taxRate: 23 }],
      transaction: tx,
    });
    check('Available stock order can reserve before action', availableOrder.fulfillmentPlan?.canReserve === true, `status=${availableOrder.fulfillmentPlan?.status}`);

    const reservedDetail = await orderService.reserveOrderStock(availableOrder.id, {}, ctx, { transaction: tx });
    const reservedCount = await activeReservationCount(company.id, availableOrder.id, tx);
    check('Reserve action creates active reservation', reservedCount === 1, `count=${reservedCount}`);
    check('Reserve action returns updated detail DTO', qty(reservedDetail.fulfillmentPlan?.lines?.[0]?.reservedQty) === 3, `reserved=${reservedDetail.fulfillmentPlan?.lines?.[0]?.reservedQty}`);

    await orderService.reserveOrderStock(availableOrder.id, {}, ctx, { transaction: tx });
    const repeatCount = await activeReservationCount(company.id, availableOrder.id, tx);
    check('Repeat reserve is idempotent without duplicate reservations', repeatCount === reservedCount, `before=${reservedCount} after=${repeatCount}`);

    const shortageOrder = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [{ productId: shortage.id, quantity: 10, unitPriceNet: 100, taxRate: 23 }],
      transaction: tx,
    });
    await expectReserveError('Shortage returns INSUFFICIENT_STOCK', shortageOrder.id, 'INSUFFICIENT_STOCK', ctx);
    check('Shortage reserve creates no reservations', await activeReservationCount(company.id, shortageOrder.id, tx) === 0);

    const splitOrder = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [
        { productId: splitOne.id, quantity: 3, unitPriceNet: 100, taxRate: 23 },
        { productId: splitTwo.id, quantity: 3, unitPriceNet: 100, taxRate: 23 },
      ],
      transaction: tx,
    });
    check('Split test order has split_suggested mode', splitOrder.fulfillmentPlan?.mode === 'split_suggested', `mode=${splitOrder.fulfillmentPlan?.mode}`);
    await expectReserveError('Split mode returns SPLIT_RESERVATION_REQUIRED', splitOrder.id, 'SPLIT_RESERVATION_REQUIRED', ctx);
    check('Split reserve creates no reservations', await activeReservationCount(company.id, splitOrder.id, tx) === 0);

    const serviceOrder = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [{ productId: service.id, quantity: 1, unitPriceNet: 100, taxRate: 23 }],
      transaction: tx,
    });
    await expectReserveError('Service-only order returns no reservation needed', serviceOrder.id, 'NO_STOCK_RESERVATION_NEEDED', ctx);
    check('Service-only reserve creates no reservations', await activeReservationCount(company.id, serviceOrder.id, tx) === 0);

    await tx.rollback();
    tx = null;
    check('Disposable reserve action data rolled back', true);

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      process.exitCode = 1;
      // eslint-disable-next-line no-console
      console.error(`OMS order reserve action smoke failed: ${failed.length} failing check(s)`);
    } else {
      // eslint-disable-next-line no-console
      console.log('OMS order reserve action smoke passed');
    }
  } catch (error) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('OMS order reserve action smoke failed:', error);
    if (tx && !tx.finished) {
      await tx.rollback().catch((rollbackError) => {
        // eslint-disable-next-line no-console
        console.error('OMS order reserve action rollback failed:', rollbackError);
      });
    }
  } finally {
    await sequelize.close();
  }
})();
