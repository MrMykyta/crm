'use strict';

// Standalone runtime smoke for C3 product stock cache sync.
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
// Run in backend container:
//   docker compose exec backend node scripts/smokeProductStockCache.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Warehouse,
  Location,
  Product,
  Counterparty,
  CompanyWarehouseDocumentSetting,
} = require('../src/models');

const inventoryService = require('../src/services/wms/inventoryService');
const orderService = require('../src/services/oms/orderService');
const adjustmentService = require('../src/services/wms/adjustmentService');
const productStockCacheService = require('../src/services/pim/productStockCacheService');

const results = [];

function check(name, cond, extra = '') {
  const ok = Boolean(cond);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const company = await Company.create({ name: 'C3 Stock Cache Smoke' }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'C3-WH',
        name: 'C3 Warehouse',
        isActive: true,
      },
      { transaction: t }
    );

    const location = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'C3-A',
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

    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'C3 Product',
        slug: `c3-product-${Date.now()}`,
        sku: 'C3-SKU',
        cost: 20, // unit cost used by opening-balance init below (G1.3 wiring)
      },
      { transaction: t }
    );

    const counterparty = await Counterparty.create(
      {
        id: crypto.randomUUID(),
        companyId,
        shortName: 'C3 Counterparty',
        type: 'client',
        status: 'active',
      },
      { transaction: t }
    );

    const userContext = { companyId, userId: null, transaction: t };

    // PZ +10 via inventory applyMove -> must update Product.stock_quantity cache.
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
        refId: crypto.randomUUID(),
        refItemId: crypto.randomUUID(),
      },
      { transaction: t }
    );

    // G1.3: seeding via inventoryService.applyMove bypasses receiptService and creates no
    // cost_layer. Run opening-balance init so the order→ship flow later in this smoke can
    // consume FIFO layers from the seeded qty_on_hand.
    const openingBalanceService = require('../src/services/wms/costingOpeningBalanceService');
    await openingBalanceService.initializeForCompany(companyId, {}, { transaction: t });

    await product.reload({ transaction: t });
    check('PZ +10 -> Product.stock_quantity=10', toNumber(product.stockQuantity) === 10, `stock=${product.stockQuantity}`);
    check('PZ +10 -> Product.reserved_quantity=0', toNumber(product.reservedQuantity) === 0, `reserved=${product.reservedQuantity}`);

    const order = await orderService.createOrder(
      {
        counterpartyId: counterparty.id,
        currencyCode: 'PLN',
        status: 'new',
        items: [
          {
            productId: product.id,
            quantity: 3,
            unitPriceNet: 100,
            taxRate: 23,
          },
        ],
      },
      userContext,
      { transaction: t }
    );

    await orderService.changeOrderStatus(order.id, 'confirmed', {}, userContext, { transaction: t });
    await product.reload({ transaction: t });
    check('confirm order 3 -> Product.reserved_quantity=3', toNumber(product.reservedQuantity) === 3, `reserved=${product.reservedQuantity}`);
    check('confirm order 3 -> Product.stock_quantity=10', toNumber(product.stockQuantity) === 10, `stock=${product.stockQuantity}`);

    await orderService.changeOrderStatus(order.id, 'shipped', {}, userContext, { transaction: t });
    await product.reload({ transaction: t });
    check('ship -> Product.stock_quantity=7', toNumber(product.stockQuantity) === 7, `stock=${product.stockQuantity}`);
    check('ship -> Product.reserved_quantity=0', toNumber(product.reservedQuantity) === 0, `reserved=${product.reservedQuantity}`);

    const pwDraft = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        documentType: 'PW',
        reason: 'C3 PW +2',
        items: [
          {
            productId: product.id,
            locationId: location.id,
            qtyDelta: 2,
          },
        ],
      },
      t
    );
    await adjustmentService.post(companyId, pwDraft.id, t);
    await product.reload({ transaction: t });
    check('PW post +2 updates Product.stock_quantity=9', toNumber(product.stockQuantity) === 9, `stock=${product.stockQuantity}`);

    const rwDraft = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        documentType: 'RW',
        reason: 'C3 RW -1',
        items: [
          {
            productId: product.id,
            locationId: location.id,
            qtyDelta: -1,
          },
        ],
      },
      t
    );
    await adjustmentService.post(companyId, rwDraft.id, t);
    await product.reload({ transaction: t });
    check('RW post -1 updates Product.stock_quantity=8', toNumber(product.stockQuantity) === 8, `stock=${product.stockQuantity}`);

    await product.update(
      {
        stockQuantity: 999,
        reservedQuantity: 999,
      },
      { transaction: t }
    );
    await product.reload({ transaction: t });
    check('manual corruption applied', toNumber(product.stockQuantity) === 999 && toNumber(product.reservedQuantity) === 999);

    const recalcAllResult = await productStockCacheService.recalcAllProductsStock(companyId, { transaction: t });
    await product.reload({ transaction: t });
    check('recalcAll updates at least one product', recalcAllResult.updatedCount >= 1, `updated=${recalcAllResult.updatedCount}`);
    check('recalcAll fixes stock_quantity to 8', toNumber(product.stockQuantity) === 8, `stock=${product.stockQuantity}`);
    check('recalcAll fixes reserved_quantity to 0', toNumber(product.reservedQuantity) === 0, `reserved=${product.reservedQuantity}`);
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
