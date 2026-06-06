'use strict';

// Standalone runtime smoke for WMS stock-balances API service (T1.2b).
//
// NON-DESTRUCTIVE: all operations are wrapped into one transaction and ALWAYS rolled back.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeStockBalances.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Warehouse,
  Location,
  Product,
  Reservation,
  Counterparty,
  Order,
  OrderItem,
} = require('../src/models');
const inventoryService = require('../src/services/wms/inventoryService');
const { listStockBalances } = require('../src/services/wms/stockBalanceService');

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

    const company = await Company.create({ name: 'T1.2b Stock Balances Company' }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'SB-WH',
        name: 'Stock Balance WH',
        isActive: true,
      },
      { transaction: t }
    );

    const location = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'SB-A',
        type: 'bulk',
      },
      { transaction: t }
    );

    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'Stock Balance Product',
        slug: `stock-balance-${Date.now()}`,
        sku: 'SB-001',
      },
      { transaction: t }
    );

    const counterparty = await Counterparty.create(
      {
        id: crypto.randomUUID(),
        companyId,
        shortName: 'SB Counterparty',
        type: 'client',
        status: 'active',
      },
      { transaction: t }
    );

    const order = await Order.create(
      {
        id: crypto.randomUUID(),
        companyId,
        customerId: counterparty.id,
        currencyCode: 'PLN',
        status: 'draft',
      },
      { transaction: t }
    );

    const orderItem = await OrderItem.create(
      {
        id: crypto.randomUUID(),
        companyId,
        orderId: order.id,
        productId: product.id,
        variantId: null,
        qty: 1,
        priceNet: 1,
        priceGross: 1,
        taxRate: 0,
      },
      { transaction: t }
    );

    await inventoryService.applyMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: location.id,
        productId: product.id,
        variantId: null,
        qty: 10,
        refType: 'PZ',
        refId: warehouse.id,
      },
      { transaction: t }
    );

    await Reservation.create(
      {
        id: crypto.randomUUID(),
        companyId,
        orderId: order.id,
        orderItemId: orderItem.id,
        warehouseId: warehouse.id,
        productId: product.id,
        variantId: null,
        qty: 3,
        status: 'active',
      },
      { transaction: t }
    );

    const list = await listStockBalances(companyId, {}, { transaction: t });
    check('stock-balances returns at least one row', list.length > 0, `rows=${list.length}`);

    const row = list.find((entry) => entry.warehouseId === warehouse.id && entry.productId === product.id && entry.variantId === null);
    check('target row exists', Boolean(row));
    check('onHand = 10', row && row.onHand === 10, `onHand=${row && row.onHand}`);
    check('reserved = 3', row && row.reserved === 3, `reserved=${row && row.reserved}`);
    check('available = 7', row && row.available === 7, `available=${row && row.available}`);

    const onlyPositive = await listStockBalances(companyId, { onlyPositive: 'true' }, { transaction: t });
    check('onlyPositive keeps non-zero row', onlyPositive.some((entry) => entry.productId === product.id), `rows=${onlyPositive.length}`);

    const searchByName = await listStockBalances(companyId, { search: 'balance product' }, { transaction: t });
    check('search by product name works', searchByName.some((entry) => entry.productId === product.id), `rows=${searchByName.length}`);

    const searchBySku = await listStockBalances(companyId, { search: 'SB-001' }, { transaction: t });
    check('search by product sku works', searchBySku.some((entry) => entry.productId === product.id), `rows=${searchBySku.length}`);

    const warehouseFiltered = await listStockBalances(companyId, { warehouseId: warehouse.id }, { transaction: t });
    check('warehouseId filter works', warehouseFiltered.every((entry) => entry.warehouseId === warehouse.id), `rows=${warehouseFiltered.length}`);

    const productFiltered = await listStockBalances(companyId, { productId: product.id }, { transaction: t });
    check('productId filter works', productFiltered.every((entry) => entry.productId === product.id), `rows=${productFiltered.length}`);
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

  const failed = results.filter((item) => !item.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();
