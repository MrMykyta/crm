'use strict';

// Runtime smoke for WMS-POLICY-2C-5 Cycle Count without location.
//
// The script runs inside one transaction and always rolls back.
//
// Run:
//   node scripts/smokeCycleCountWithoutLocation.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  Warehouse,
  Location,
  Product,
  InventoryItem,
  CountItem,
  AdjustmentItem,
  StockMove,
} = require('../src/models');
const inventoryService = require('../src/services/wms/inventoryService');
const inventoryCountService = require('../src/services/wms/inventoryCountService');
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
      sku: `P2C5-${label}-${suffix}`.slice(0, 64),
      name: `Policy2C5 ${label} ${suffix}`,
      slug: `policy2c5-${label.toLowerCase()}-${suffix}`,
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

async function createAndReconcileCount({ companyId, warehouseId, productId, locationId, countedQty, transaction }) {
  const count = await inventoryCountService.createCycleCount(
    companyId,
    {
      warehouseId,
      items: [
        {
          productId,
          variantId: null,
          locationId,
          countedQty,
        },
      ],
    },
    { transaction }
  );
  const result = await inventoryCountService.reconcileCycleCount(count.id, { companyId, transaction });
  const countItem = await CountItem.findOne({
    where: { countId: count.id, productId },
    transaction,
  });
  return { count, result, countItem };
}

async function loadAdjustmentLine({ adjustmentId, productId, transaction }) {
  return AdjustmentItem.findOne({
    where: {
      adjustmentId,
      productId,
    },
    transaction,
  });
}

async function loadAdjustmentMove({ companyId, refType, refId, transaction }) {
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
    const company = await Company.create({ name: `Policy2C5 Smoke ${suffix}` }, { transaction: t });
    await CompanyWarehouseDocumentSetting.create(
      { companyId: company.id, inventoryCostMethod: 'FIFO', costingInitializedAt: new Date() },
      { transaction: t }
    );
    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        code: `P2C5-${suffix}`.slice(0, 32),
        name: 'Policy2C5 Warehouse',
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

    const rwProduct = await createProduct(company.id, suffix, 'RW-NOLOC', t);
    await seedStock({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: rwProduct.id,
      qty: 10,
      transaction: t,
    });
    const rwCount = await createAndReconcileCount({
      companyId: company.id,
      warehouseId: warehouse.id,
      productId: rwProduct.id,
      locationId: null,
      countedQty: 7,
      transaction: t,
    });
    const rwAdjustment = rwCount.result.adjustments.find((row) => row.documentType === 'RW');
    const rwLine = await loadAdjustmentLine({ adjustmentId: rwAdjustment?.id, productId: rwProduct.id, transaction: t });
    const rwMove = await loadAdjustmentMove({ companyId: company.id, refType: 'RW', refId: rwAdjustment?.id, transaction: t });
    const rwFinalQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: rwProduct.id,
      transaction: t,
    });
    check('Cycle count without location stores CountItem.locationId=null', rwCount.countItem?.locationId === null);
    check('Cycle count without location system qty was 10 via RW delta -3', asNumber(rwLine?.qtyDelta) === -3, `qtyDelta=${rwLine?.qtyDelta}`);
    check('Cycle count without location creates RW adjustment item locationId=null', rwLine?.locationId === null);
    check('Cycle count without location RW StockMove.fromLocationId=null', rwMove?.fromLocationId === null && rwMove?.toLocationId === null);
    check('Cycle count without location final warehouse-level qty is counted qty', rwFinalQty === 7, `qty=${rwFinalQty}`);

    const pwProduct = await createProduct(company.id, suffix, 'PW-NOLOC', t);
    const pwCount = await createAndReconcileCount({
      companyId: company.id,
      warehouseId: warehouse.id,
      productId: pwProduct.id,
      locationId: null,
      countedQty: 4,
      transaction: t,
    });
    const pwAdjustment = pwCount.result.adjustments.find((row) => row.documentType === 'PW');
    const pwLine = await loadAdjustmentLine({ adjustmentId: pwAdjustment?.id, productId: pwProduct.id, transaction: t });
    const pwMove = await loadAdjustmentMove({ companyId: company.id, refType: 'PW', refId: pwAdjustment?.id, transaction: t });
    const pwFinalQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: pwProduct.id,
      transaction: t,
    });
    check('Cycle count positive delta creates PW adjustment locationId=null', pwAdjustment && pwLine?.locationId === null);
    check('Cycle count positive delta writes StockMove.toLocationId=null', pwMove?.toLocationId === null && pwMove?.fromLocationId === null);
    check('Cycle count positive delta adjusts warehouse-level qty', pwFinalQty === 4, `qty=${pwFinalQty}`);

    const locationProduct = await createProduct(company.id, suffix, 'LOC', t);
    await seedStock({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: locationProduct.id,
      qty: 6,
      transaction: t,
    });
    const locationCount = await createAndReconcileCount({
      companyId: company.id,
      warehouseId: warehouse.id,
      productId: locationProduct.id,
      locationId: location.id,
      countedQty: 3,
      transaction: t,
    });
    const locationAdjustment = locationCount.result.adjustments.find((row) => row.documentType === 'RW');
    const locationLine = await loadAdjustmentLine({ adjustmentId: locationAdjustment?.id, productId: locationProduct.id, transaction: t });
    const locationMove = await loadAdjustmentMove({ companyId: company.id, refType: 'RW', refId: locationAdjustment?.id, transaction: t });
    const locationFinalQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: locationProduct.id,
      transaction: t,
    });
    check('Cycle count with location stores CountItem.locationId', locationCount.countItem?.locationId === location.id);
    check('Cycle count with location creates adjustment item with location', locationLine?.locationId === location.id);
    check('Cycle count with location writes location StockMove', locationMove?.fromLocationId === location.id);
    check('Cycle count with location adjusts location-level qty', locationFinalQty === 3, `qty=${locationFinalQty}`);
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
