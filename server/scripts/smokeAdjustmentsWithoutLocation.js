'use strict';

// Runtime smoke for WMS-POLICY-2C-4 RW/PW adjustments without location.
//
// The script runs inside one transaction and always rolls back.
//
// Run:
//   node scripts/smokeAdjustmentsWithoutLocation.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Warehouse,
  Location,
  Product,
  InventoryItem,
  StockMove,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const inventoryService = require('../src/services/wms/inventoryService');
const adjustmentService = require('../src/services/wms/adjustmentService');
const costingService = require('../src/services/wms/costingService');

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
      sku: `P2C4-${label}-${suffix}`.slice(0, 64),
      name: `Policy2C4 ${label} ${suffix}`,
      slug: `policy2c4-${label.toLowerCase()}-${suffix}`,
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

async function createAdjustment({ companyId, warehouseId, documentType, productId, locationId, qtyDelta, transaction }) {
  return adjustmentService.create(
    companyId,
    {
      warehouseId,
      documentType,
      reason: `Policy2C4 ${documentType}`,
      items: [
        {
          productId,
          variantId: null,
          locationId,
          qtyDelta,
          unitCost: 20,
          currency: 'PLN',
        },
      ],
    },
    transaction
  );
}

async function singleMove({ companyId, refType, refId, transaction }) {
  return StockMove.findOne({
    where: {
      companyId,
      refType,
      refId,
      type: 'adjustment',
    },
    transaction,
  });
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const company = await Company.create({ name: `Policy2C4 Smoke ${suffix}` }, { transaction: t });
    await CompanyWarehouseDocumentSetting.create(
      { companyId: company.id, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );
    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        code: `P2C4-${suffix}`.slice(0, 32),
        name: 'Policy2C4 Warehouse',
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

    const pwProduct = await createProduct(company.id, suffix, 'PW-NOLOC', t);
    const pw = await createAdjustment({
      companyId: company.id,
      warehouseId: warehouse.id,
      documentType: 'PW',
      productId: pwProduct.id,
      locationId: null,
      qtyDelta: 5,
      transaction: t,
    });
    check('PW without location creates draft item with locationId=null', pw?.items?.[0]?.locationId === null);
    await adjustmentService.post(company.id, pw.id, t);
    const pwWarehouseQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: pwProduct.id,
      transaction: t,
    });
    const pwMove = await singleMove({ companyId: company.id, refType: 'PW', refId: pw.id, transaction: t });
    check('PW without location increases warehouse-level InventoryItem', pwWarehouseQty === 5, `qty=${pwWarehouseQty}`);
    check('PW without location writes StockMove.toLocationId=null', pwMove?.toLocationId === null && pwMove?.fromLocationId === null);

    const rwProduct = await createProduct(company.id, suffix, 'RW-NOLOC', t);
    await seedStock({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: rwProduct.id,
      qty: 9,
      transaction: t,
    });
    const rw = await createAdjustment({
      companyId: company.id,
      warehouseId: warehouse.id,
      documentType: 'RW',
      productId: rwProduct.id,
      locationId: null,
      qtyDelta: -4,
      transaction: t,
    });
    await adjustmentService.post(company.id, rw.id, t);
    const rwWarehouseQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: rwProduct.id,
      transaction: t,
    });
    const rwMove = await singleMove({ companyId: company.id, refType: 'RW', refId: rw.id, transaction: t });
    check('RW without location decreases warehouse-level InventoryItem', rwWarehouseQty === 5, `qty=${rwWarehouseQty}`);
    check('RW without location writes StockMove.fromLocationId=null', rwMove?.fromLocationId === null && rwMove?.toLocationId === null);

    const pwLocationProduct = await createProduct(company.id, suffix, 'PW-LOC', t);
    const pwLocation = await createAdjustment({
      companyId: company.id,
      warehouseId: warehouse.id,
      documentType: 'PW',
      productId: pwLocationProduct.id,
      locationId: location.id,
      qtyDelta: 6,
      transaction: t,
    });
    await adjustmentService.post(company.id, pwLocation.id, t);
    const pwLocationQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: pwLocationProduct.id,
      transaction: t,
    });
    const pwLocationMove = await singleMove({ companyId: company.id, refType: 'PW', refId: pwLocation.id, transaction: t });
    check('PW with location still increases location-level InventoryItem', pwLocationQty === 6, `qty=${pwLocationQty}`);
    check('PW with location still writes StockMove.toLocationId', pwLocationMove?.toLocationId === location.id);

    const rwLocationProduct = await createProduct(company.id, suffix, 'RW-LOC', t);
    await seedStock({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: rwLocationProduct.id,
      qty: 7,
      transaction: t,
    });
    const rwLocation = await createAdjustment({
      companyId: company.id,
      warehouseId: warehouse.id,
      documentType: 'RW',
      productId: rwLocationProduct.id,
      locationId: location.id,
      qtyDelta: -3,
      transaction: t,
    });
    await adjustmentService.post(company.id, rwLocation.id, t);
    const rwLocationQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: rwLocationProduct.id,
      transaction: t,
    });
    const rwLocationMove = await singleMove({ companyId: company.id, refType: 'RW', refId: rwLocation.id, transaction: t });
    check('RW with location still decreases location-level InventoryItem', rwLocationQty === 4, `qty=${rwLocationQty}`);
    check('RW with location still writes StockMove.fromLocationId', rwLocationMove?.fromLocationId === location.id);

    const negativeProduct = await createProduct(company.id, suffix, 'NEGATIVE', t);
    await seedStock({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: negativeProduct.id,
      qty: 5,
      transaction: t,
    });
    const negativeRw = await createAdjustment({
      companyId: company.id,
      warehouseId: warehouse.id,
      documentType: 'RW',
      productId: negativeProduct.id,
      locationId: null,
      qtyDelta: -2,
      transaction: t,
    });
    await expectAppErrorIsolated(
      'RW without location does not consume location-level-only stock',
      'INSUFFICIENT_STOCK',
      t,
      (sp) => adjustmentService.post(company.id, negativeRw.id, sp)
    );
    const negativeLocationQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: negativeProduct.id,
      transaction: t,
    });
    const negativeWarehouseQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: negativeProduct.id,
      transaction: t,
    });
    const negativeMoveCount = await StockMove.count({
      where: {
        companyId: company.id,
        refType: 'RW',
        refId: negativeRw.id,
        type: 'adjustment',
      },
      transaction: t,
    });
    check('Negative RW leaves location-level stock unchanged', negativeLocationQty === 5, `qty=${negativeLocationQty}`);
    check('Negative RW does not create warehouse-level stock bucket', negativeWarehouseQty === 0, `qty=${negativeWarehouseQty}`);
    check('Negative RW does not create stock move', negativeMoveCount === 0, `moves=${negativeMoveCount}`);
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
