'use strict';

// Standalone runtime smoke for WMS opening-balance flow (G1.2c/G1.2d).
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeCostingOpeningBalance.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  CompanyWarehouseDocumentSetting,
  CostLayer,
  InventoryItem,
  Location,
  Product,
  StockMove,
  StockMoveCostAllocation,
  Warehouse,
} = require('../src/models');
const AppError = require('../src/errors/AppError');
const costingService = require('../src/services/wms/costingService');
const openingBalanceService = require('../src/services/wms/costingOpeningBalanceService');

const results = [];

function check(name, cond, extra = '') {
  const ok = Boolean(cond);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

function n(value) {
  return Number(value);
}

async function expectAppError(name, expectedCode, fn) {
  try {
    await fn();
    check(name, false, 'no error thrown');
  } catch (error) {
    check(
      name,
      error instanceof AppError && error.statusCode === 409 && error.code === expectedCode,
      `status=${error.statusCode} code=${error.code || 'null'} msg="${error.message}"`
    );
  }
}

async function createMove(payload, transaction) {
  return StockMove.create(
    {
      companyId: payload.companyId,
      type: payload.type,
      warehouseId: payload.warehouseId,
      fromLocationId: payload.fromLocationId || null,
      toLocationId: payload.toLocationId || null,
      productId: payload.productId,
      variantId: payload.variantId ?? null,
      lotId: payload.lotId ?? null,
      serialId: payload.serialId ?? null,
      qty: payload.qty,
      refType: payload.refType || null,
      refId: payload.refId || crypto.randomUUID(),
      refItemId: payload.refItemId || crypto.randomUUID(),
    },
    { transaction }
  );
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = Date.now();

    // --- 1. Scenario setup: company + warehouse + location + product + inventory_item qty=10, no layers ---
    const company = await Company.create({ name: `Opening Balance Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'OB-WH',
        name: 'OB Smoke Warehouse',
        isActive: true,
      },
      { transaction: t }
    );

    const locA = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'OB-A',
        type: 'bulk',
      },
      { transaction: t }
    );

    // Product WITHOUT cost — exercises OPENING_COST_MISSING path in scenario 4.
    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'OB Smoke Product',
        slug: `ob-smoke-product-${suffix}`,
        sku: 'OB-1',
        cost: null,
      },
      { transaction: t }
    );

    const invItem = await InventoryItem.create(
      {
        companyId,
        warehouseId: warehouse.id,
        locationId: locA.id,
        productId: product.id,
        qtyOnHand: 10,
        qtyReserved: 0,
      },
      { transaction: t }
    );
    check('setup: inventory_item created qty=10 with no covering cost_layer',
      n(invItem.qtyOnHand) === 10);

    // --- 2. consumeFifoLayers BEFORE init → COSTING_NOT_INITIALIZED ---
    const earlyShip = await createMove(
      {
        companyId,
        type: 'ship',
        warehouseId: warehouse.id,
        fromLocationId: locA.id,
        productId: product.id,
        qty: 1,
        refType: 'WZ',
      },
      t
    );
    await expectAppError(
      'consumeFifoLayers before init throws COSTING_NOT_INITIALIZED',
      'COSTING_NOT_INITIALIZED',
      () => costingService.consumeFifoLayers(earlyShip, t)
    );

    // Status BEFORE init: gapItems=1, initialized=false.
    const statusBefore = await openingBalanceService.getInitializationStatus(companyId, { transaction: t });
    check('status before init: initialized=false, gapItems=1',
      statusBefore.initialized === false && statusBefore.gapItems === 1,
      `initialized=${statusBefore.initialized} gap=${statusBefore.gapItems}`);

    // --- 3. dryRun shows layersToCreate without writing ---
    // Set Product.cost so that resolver succeeds for the dry-run plan.
    await product.update({ cost: 20 }, { transaction: t });

    const dry = await openingBalanceService.initializeForCompany(
      companyId,
      { dryRun: true },
      { transaction: t }
    );
    check('dryRun returns 1 layer to create (10 × 20 = 200)',
      dry.dryRun === true
        && dry.itemsCount === 1
        && dry.layersToCreate.length === 1
        && n(dry.layersToCreate[0].qtyIn) === 10
        && n(dry.layersToCreate[0].unitCost) === 20
        && n(dry.layersToCreate[0].totalCost) === 200,
      `items=${dry.itemsCount} qty=${dry.layersToCreate[0] && dry.layersToCreate[0].qtyIn}`);
    const layersAfterDry = await CostLayer.count({ where: { companyId }, transaction: t });
    check('dryRun writes nothing', layersAfterDry === 0, `layers=${layersAfterDry}`);
    const settingsAfterDry = await CompanyWarehouseDocumentSetting.findOne({
      where: { companyId }, transaction: t,
    });
    check('dryRun does not set costingInitializedAt', settingsAfterDry.costingInitializedAt === null,
      `initializedAt=${settingsAfterDry.costingInitializedAt}`);

    // --- 4. initialize without product cost and without fallback → OPENING_COST_MISSING ---
    await product.update({ cost: null }, { transaction: t });
    await expectAppError(
      'initialize without cost and without fallback throws OPENING_COST_MISSING',
      'OPENING_COST_MISSING',
      () => openingBalanceService.initializeForCompany(companyId, {}, { transaction: t })
    );
    const layersAfterMissing = await CostLayer.count({ where: { companyId }, transaction: t });
    check('OPENING_COST_MISSING wrote no layers', layersAfterMissing === 0, `layers=${layersAfterMissing}`);
    const settingsAfterMissing = await CompanyWarehouseDocumentSetting.findOne({
      where: { companyId }, transaction: t,
    });
    check('OPENING_COST_MISSING did not flip costingInitializedAt',
      settingsAfterMissing.costingInitializedAt === null,
      `initializedAt=${settingsAfterMissing.costingInitializedAt}`);

    // --- 5. initialize with Product.cost=20 → creates OPENING layer 10 × 20, flag set ---
    await product.update({ cost: 20 }, { transaction: t });
    const real = await openingBalanceService.initializeForCompany(
      companyId,
      {},
      { transaction: t }
    );
    check('initialize: layers created = 1, totalQty=10, totalValue=200',
      real.dryRun === false && real.itemsCount === 1
        && n(real.totalQty) === 10 && n(real.totalValue) === 200,
      `items=${real.itemsCount} qty=${real.totalQty} value=${real.totalValue}`);
    check('initialize: initializedAt is set', real.initializedAt instanceof Date,
      `initializedAt=${real.initializedAt}`);

    const openingLayers = await CostLayer.findAll({
      where: { companyId },
      transaction: t,
    });
    check('initialize: exactly 1 cost_layer exists', openingLayers.length === 1,
      `layers=${openingLayers.length}`);
    const opening = openingLayers[0];
    check('OPENING layer: sourceRefType=OPENING, sourceMoveId=null, qty=10, unitCost=20',
      opening.sourceRefType === 'OPENING'
        && opening.sourceMoveId === null
        && n(opening.qtyIn) === 10
        && n(opening.qtyRemaining) === 10
        && n(opening.unitCost) === 20
        && n(opening.totalCost) === 200,
      `ref=${opening.sourceRefType} sm=${opening.sourceMoveId} qty=${opening.qtyIn} unit=${opening.unitCost}`);

    const settingsAfterInit = await CompanyWarehouseDocumentSetting.findOne({
      where: { companyId }, transaction: t,
    });
    check('settings flag flipped: costingInitializedAt set',
      settingsAfterInit.costingInitializedAt instanceof Date,
      `initializedAt=${settingsAfterInit.costingInitializedAt}`);

    // --- 6. repeat initialize WITHOUT force → COSTING_ALREADY_INITIALIZED ---
    await expectAppError(
      'repeat initialize without force throws COSTING_ALREADY_INITIALIZED',
      'COSTING_ALREADY_INITIALIZED',
      () => openingBalanceService.initializeForCompany(companyId, {}, { transaction: t })
    );
    const layersAfterRepeat = await CostLayer.count({ where: { companyId }, transaction: t });
    check('repeat init did not add extra layers', layersAfterRepeat === 1, `layers=${layersAfterRepeat}`);

    // --- 7. after init, consume qty=3 → totalCost=60 ---
    const ship3 = await createMove(
      {
        companyId,
        type: 'ship',
        warehouseId: warehouse.id,
        fromLocationId: locA.id,
        productId: product.id,
        qty: 3,
        refType: 'WZ',
      },
      t
    );
    const consume = await costingService.consumeFifoLayers(ship3, t);
    check('after init consume 3 → totalCost=60', n(consume.totalCost) === 60,
      `total=${consume.totalCost}`);
    check('after init consume 3 → unitCost=20', n(consume.unitCost) === 20,
      `unit=${consume.unitCost}`);
    check('after init consume 3 → 1 allocation row', consume.allocations.length === 1,
      `allocations=${consume.allocations.length}`);
    const openingAfterConsume = await CostLayer.findByPk(opening.id, { transaction: t });
    check('OPENING layer qtyRemaining decreased 10 → 7',
      n(openingAfterConsume.qtyRemaining) === 7,
      `remaining=${openingAfterConsume.qtyRemaining}`);

    // Bonus: force-mode is rejected after consumption (OPENING_LAYERS_ALREADY_CONSUMED).
    await expectAppError(
      'force re-init after consumption rejects (OPENING_LAYERS_ALREADY_CONSUMED)',
      'OPENING_LAYERS_ALREADY_CONSUMED',
      () => openingBalanceService.initializeForCompany(
        companyId, { force: true }, { transaction: t }
      )
    );

    // --- 8. Sentinel: settings DTO exposes costingInitializedAt read-only ---
    const settingsService = require('../src/services/crm/companyWarehouseDocumentSettingsService');
    const dto = await settingsService.getCompanyWarehouseDocumentSettings({
      companyId, transaction: t,
    });
    check('settings DTO exposes costingInitializedAt',
      Object.prototype.hasOwnProperty.call(dto, 'costingInitializedAt')
        && dto.costingInitializedAt !== null,
      `dto.costingInitializedAt=${dto.costingInitializedAt}`);

    // Try to inject costingInitializedAt via the update endpoint and verify it is ignored.
    const fakeDate = new Date('2099-01-01T00:00:00Z');
    await settingsService.updateCompanyWarehouseDocumentSettings({
      companyId,
      payload: { costingInitializedAt: fakeDate },
      transaction: t,
    });
    const settingsAfterUpdate = await CompanyWarehouseDocumentSetting.findOne({
      where: { companyId }, transaction: t,
    });
    check('update endpoint ignores costingInitializedAt in payload (read-only)',
      settingsAfterUpdate.costingInitializedAt instanceof Date
        && settingsAfterUpdate.costingInitializedAt.getTime() !== fakeDate.getTime(),
      `after=${settingsAfterUpdate.costingInitializedAt} fake=${fakeDate}`);
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

  const failed = results.filter((row) => !row.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();
