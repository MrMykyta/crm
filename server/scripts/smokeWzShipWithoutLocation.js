'use strict';

// Runtime smoke for WMS-POLICY-2C-2 WZ ship without source location.
//
// The script runs inside one transaction and always rolls back.
//
// Run:
//   node scripts/smokeWzShipWithoutLocation.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Warehouse,
  Location,
  Product,
  InventoryItem,
  Shipment,
  StockMove,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const inventoryService = require('../src/services/wms/inventoryService');
const shipmentService = require('../src/services/wms/shipmentService');
const costingService = require('../src/services/wms/costingService');
const stockBalanceService = require('../src/services/wms/stockBalanceService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function expectAppErrorIsolated(name, expectedCode, outerT, fn) {
  try {
    await sequelize.transaction({ transaction: outerT }, async (sp) => {
      await fn(sp);
    });
    check(name, false, 'no error thrown');
  } catch (error) {
    check(
      name,
      error instanceof AppError && error.code === expectedCode,
      `status=${error.statusCode || 'null'} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

async function inventoryQty({ companyId, warehouseId, locationId, productId, transaction }) {
  const row = await InventoryItem.findOne({
    where: {
      companyId,
      warehouseId,
      locationId,
      productId,
      variantId: null,
      lotId: null,
      serialId: null,
    },
    transaction,
  });
  return asNumber(row?.qtyOnHand);
}

async function createProduct(companyId, suffix, label, transaction) {
  return Product.create(
    {
      id: crypto.randomUUID(),
      companyId,
      sku: `P2C2-${label}-${suffix}`.slice(0, 64),
      name: `Policy2C2 ${label} ${suffix}`,
      slug: `policy2c2-${label.toLowerCase()}-${suffix}`,
      status: 'active',
      trackInventory: true,
      isService: false,
      cost: 20,
      currency: 'PLN',
    },
    { transaction }
  );
}

async function seedStock({ companyId, warehouseId, locationId, productId, qty, transaction }) {
  const move = await inventoryService.applyMove(
    {
      companyId,
      type: 'receipt',
      warehouseId,
      toLocationId: locationId,
      productId,
      variantId: null,
      qty,
      refType: 'TEST',
      refId: crypto.randomUUID(),
      refItemId: crypto.randomUUID(),
    },
    { transaction }
  );
  await costingService.applyCostingForMove(
    move,
    { costInput: { unitCost: 20, currency: 'PLN' } },
    transaction
  );
  return move;
}

async function createShipment({ companyId, warehouseId, productId, qty, transaction }) {
  const shipment = await shipmentService.create(
    companyId,
    {
      warehouseId,
      items: [{ productId, variantId: null, qty }],
    },
    transaction
  );
  return { shipment, item: shipment.items[0] };
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const company = await Company.create({ name: `Policy2C2 Smoke ${suffix}` }, { transaction: t });
    await CompanyWarehouseDocumentSetting.create(
      { companyId: company.id, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );
    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        code: `P2C2-${suffix}`.slice(0, 32),
        name: 'Policy2C2 Warehouse',
        isActive: true,
      },
      { transaction: t }
    );
    const location = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        warehouseId: warehouse.id,
        code: `LOC-${suffix}`.slice(0, 64),
        type: 'bulk',
      },
      { transaction: t }
    );

    const warehouseProduct = await createProduct(company.id, suffix, 'WAREHOUSE', t);
    await seedStock({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: warehouseProduct.id,
      qty: 10,
      transaction: t,
    });
    const warehouseShipment = await createShipment({
      companyId: company.id,
      warehouseId: warehouse.id,
      productId: warehouseProduct.id,
      qty: 4,
      transaction: t,
    });
    const shipped = await shipmentService.shipItem(
      company.id,
      warehouseShipment.item.id,
      { qty: 4 },
      t
    );
    check('WZ ship item without source location returns item', Boolean(shipped?.id));

    const shippedDoc = await Shipment.findByPk(warehouseShipment.shipment.id, { transaction: t });
    check('WZ without source location closes shipped document', shippedDoc?.status === 'shipped', `status=${shippedDoc?.status}`);

    const warehouseQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: warehouseProduct.id,
      transaction: t,
    });
    check('WZ without source location decreases warehouse-level InventoryItem', warehouseQty === 6, `qty=${warehouseQty}`);

    const warehouseMove = await StockMove.findOne({
      where: {
        companyId: company.id,
        refType: 'WZ',
        refId: warehouseShipment.shipment.id,
        refItemId: warehouseShipment.item.id,
        type: 'ship',
      },
      transaction: t,
    });
    check('WZ without source location writes StockMove.fromLocationId=null', warehouseMove?.fromLocationId === null);
    check('WZ item shipped qty is represented by StockMove qty', asNumber(warehouseMove?.qty) === 4, `qty=${warehouseMove?.qty}`);

    const balances = await stockBalanceService.listStockBalances(
      company.id,
      { warehouseId: warehouse.id, productId: warehouseProduct.id },
      { transaction: t }
    );
    const balanceRow = balances.find((row) => row.productId === warehouseProduct.id && row.warehouseId === warehouse.id);
    check('WZ without source location updates stock balance', balanceRow && asNumber(balanceRow.onHand) === 6, `onHand=${balanceRow?.onHand}`);

    const locationProduct = await createProduct(company.id, suffix, 'LOCATION', t);
    await seedStock({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: locationProduct.id,
      qty: 8,
      transaction: t,
    });
    const locationShipment = await createShipment({
      companyId: company.id,
      warehouseId: warehouse.id,
      productId: locationProduct.id,
      qty: 3,
      transaction: t,
    });
    await shipmentService.shipItem(
      company.id,
      locationShipment.item.id,
      { qty: 3, fromLocationId: location.id },
      t
    );
    const locationQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: locationProduct.id,
      transaction: t,
    });
    check('WZ with source location still consumes location-level InventoryItem', locationQty === 5, `qty=${locationQty}`);

    const locationMove = await StockMove.findOne({
      where: {
        companyId: company.id,
        refType: 'WZ',
        refId: locationShipment.shipment.id,
        refItemId: locationShipment.item.id,
        type: 'ship',
      },
      transaction: t,
    });
    check('WZ with source location still writes StockMove.fromLocationId', locationMove?.fromLocationId === location.id);

    const locationOnlyProduct = await createProduct(company.id, suffix, 'NEGATIVE', t);
    await seedStock({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: locationOnlyProduct.id,
      qty: 7,
      transaction: t,
    });
    const negativeShipment = await createShipment({
      companyId: company.id,
      warehouseId: warehouse.id,
      productId: locationOnlyProduct.id,
      qty: 2,
      transaction: t,
    });
    await expectAppErrorIsolated(
      'WZ without source location does not consume location-level-only stock',
      'INSUFFICIENT_STOCK',
      t,
      (sp) => shipmentService.shipItem(company.id, negativeShipment.item.id, { qty: 2 }, sp)
    );

    const negativeLocationQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: locationOnlyProduct.id,
      transaction: t,
    });
    const negativeWarehouseQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: locationOnlyProduct.id,
      transaction: t,
    });
    const negativeMoveCount = await StockMove.count({
      where: {
        companyId: company.id,
        refType: 'WZ',
        refId: negativeShipment.shipment.id,
        refItemId: negativeShipment.item.id,
        type: 'ship',
      },
      transaction: t,
    });
    check('Negative WZ leaves location-level stock unchanged', negativeLocationQty === 7, `qty=${negativeLocationQty}`);
    check('Negative WZ does not create warehouse-level stock bucket', negativeWarehouseQty === 0, `qty=${negativeWarehouseQty}`);
    check('Negative WZ does not create stock move', negativeMoveCount === 0, `moves=${negativeMoveCount}`);
  } catch (error) {
    check('script execution', false, error && error.message);
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    if (t) {
      await t.rollback();
      // eslint-disable-next-line no-console
      console.log('-- transaction rolled back (no data persisted) --');
    }
    await sequelize.close();
  }

  const failed = results.filter((result) => !result.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();
