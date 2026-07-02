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
  OrderItem,
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
    number: `FUL-${suffix}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
    counterpartyId,
    ownerId,
    currencyCode: 'PLN',
    status: 'new',
    items,
  }, ctx, { transaction });
  return orderService.getOrderById(order.id, ctx);
}

function lineBySku(plan, skuPrefix) {
  return (plan?.lines || []).find((line) => String(line.sku || '').startsWith(skuPrefix));
}

(async () => {
  let tx;
  try {
    await sequelize.authenticate();
    tx = await sequelize.transaction();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await User.create({
      id: crypto.randomUUID(),
      email: `oms-fulfillment-plan-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: tx });

    const company = await Company.create({
      id: crypto.randomUUID(),
      name: `OMS Fulfillment Plan Smoke ${suffix}`,
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
      shortName: `Fulfillment Customer ${suffix}`.slice(0, 120),
      fullName: `Fulfillment Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
    }, { transaction: tx });

    const warehouseA = await Warehouse.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      code: `FPA-${String(Date.now()).slice(-6)}`,
      name: 'Smoke Warehouse A',
      isActive: true,
    }, { transaction: tx });
    const warehouseB = await Warehouse.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      code: `FPB-${String(Date.now()).slice(-6)}`,
      name: 'Smoke Warehouse B',
      isActive: true,
    }, { transaction: tx });

    await CompanyWarehouseDocumentSetting.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      defaultWarehouseId: warehouseA.id,
    }, { transaction: tx });

    const coverAllA = await createProduct({ companyId: company.id, suffix, code: 'COVERA', transaction: tx });
    const defaultPartial = await createProduct({ companyId: company.id, suffix, code: 'DEFB', transaction: tx });
    const splitOne = await createProduct({ companyId: company.id, suffix, code: 'SPLITA', transaction: tx });
    const splitTwo = await createProduct({ companyId: company.id, suffix, code: 'SPLITB', transaction: tx });
    const shortage = await createProduct({ companyId: company.id, suffix, code: 'SHORT', transaction: tx });
    const reserved = await createProduct({ companyId: company.id, suffix, code: 'RESV', transaction: tx });
    const service = await createProduct({
      companyId: company.id,
      suffix,
      code: 'SERV',
      trackInventory: false,
      isService: true,
      transaction: tx,
    });

    await Promise.all([
      createInventory({ companyId: company.id, warehouseId: warehouseA.id, productId: coverAllA.id, qtyOnHand: 20, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseA.id, productId: defaultPartial.id, qtyOnHand: 1, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseB.id, productId: defaultPartial.id, qtyOnHand: 20, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseA.id, productId: splitOne.id, qtyOnHand: 5, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseB.id, productId: splitTwo.id, qtyOnHand: 5, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseA.id, productId: shortage.id, qtyOnHand: 2, transaction: tx }),
      createInventory({ companyId: company.id, warehouseId: warehouseA.id, productId: reserved.id, qtyOnHand: 8, transaction: tx }),
    ]);

    const ctx = { id: owner.id, userId: owner.id, companyId: company.id, transaction: tx };

    const orderA = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [{ productId: coverAllA.id, quantity: 3, unitPriceNet: 100, taxRate: 23 }],
      transaction: tx,
    });
    check('Warehouse A covers all items', orderA.fulfillmentPlan?.recommendedWarehouseId === warehouseA.id, orderA.fulfillmentPlan?.recommendedWarehouseName || '');
    check('Warehouse A plan can reserve', orderA.fulfillmentPlan?.canReserve === true, `status=${orderA.fulfillmentPlan?.status}`);

    const orderB = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [{ productId: defaultPartial.id, quantity: 3, unitPriceNet: 100, taxRate: 23 }],
      transaction: tx,
    });
    check('Default warehouse partial, Warehouse B covers all', orderB.fulfillmentPlan?.recommendedWarehouseId === warehouseB.id, orderB.fulfillmentPlan?.recommendedWarehouseName || '');

    const orderSplit = await createOrder({
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
    check('Split only possible suggests split mode', orderSplit.fulfillmentPlan?.mode === 'split_suggested', `mode=${orderSplit.fulfillmentPlan?.mode}`);
    check('Split plan has per-line warehouses', Boolean(lineBySku(orderSplit.fulfillmentPlan, 'SPLITA')?.recommendedWarehouseId && lineBySku(orderSplit.fulfillmentPlan, 'SPLITB')?.recommendedWarehouseId));

    const orderShortage = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [{ productId: shortage.id, quantity: 10, unitPriceNet: 100, taxRate: 23 }],
      transaction: tx,
    });
    check('Shortage plan reports shortage status', orderShortage.fulfillmentPlan?.status === 'shortage', `status=${orderShortage.fulfillmentPlan?.status}`);
    check('Shortage plan cannot reserve', orderShortage.fulfillmentPlan?.canReserve === false);
    check('Shortage quantity surfaced', qty(orderShortage.fulfillmentPlan?.lines?.[0]?.shortageQty) > 0, `shortage=${orderShortage.fulfillmentPlan?.lines?.[0]?.shortageQty}`);

    const orderServiceOnly = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [{ productId: service.id, quantity: 1, unitPriceNet: 100, taxRate: 23 }],
      transaction: tx,
    });
    check('Service item is not stock tracked', orderServiceOnly.fulfillmentPlan?.lines?.[0]?.status === 'not_stock_tracked', `status=${orderServiceOnly.fulfillmentPlan?.lines?.[0]?.status}`);
    check('Service item has no shortage', qty(orderServiceOnly.fulfillmentPlan?.lines?.[0]?.shortageQty) === 0);

    const reservedOrder = await createOrder({
      suffix,
      companyId: company.id,
      ownerId: owner.id,
      counterpartyId: counterparty.id,
      items: [{ productId: reserved.id, quantity: 2, unitPriceNet: 100, taxRate: 23 }],
      transaction: tx,
    });
    const reservedItem = await OrderItem.findOne({
      where: { companyId: company.id, orderId: reservedOrder.id },
      transaction: tx,
    });
    await Reservation.create({
      companyId: company.id,
      orderId: reservedOrder.id,
      orderItemId: reservedItem.id,
      warehouseId: warehouseA.id,
      productId: reserved.id,
      variantId: null,
      qty: 2,
      status: 'active',
    }, { transaction: tx });
    const reservedDetail = await orderService.getOrderById(reservedOrder.id, ctx);
    check('Existing reservation quantity surfaced', qty(reservedDetail.fulfillmentPlan?.lines?.[0]?.reservedQty) === 2, `reserved=${reservedDetail.fulfillmentPlan?.lines?.[0]?.reservedQty}`);
    check('Existing reservation warning surfaced', reservedDetail.fulfillmentPlan?.warnings?.some((warning) => warning.code === 'reservation_exists'));

    await tx.rollback();
    tx = null;
    check('Disposable fulfillment plan data rolled back', true);

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      process.exitCode = 1;
      // eslint-disable-next-line no-console
      console.error(`OMS order fulfillment plan smoke failed: ${failed.length} failing check(s)`);
    } else {
      // eslint-disable-next-line no-console
      console.log('OMS order fulfillment plan smoke passed');
    }
  } catch (error) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('OMS order fulfillment plan smoke failed:', error);
    if (tx && !tx.finished) {
      await tx.rollback().catch((rollbackError) => {
        // eslint-disable-next-line no-console
        console.error('OMS order fulfillment plan rollback failed:', rollbackError);
      });
    }
  } finally {
    await sequelize.close();
  }
})();
