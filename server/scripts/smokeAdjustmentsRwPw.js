'use strict';

// Standalone runtime smoke for RW/PW adjustments backend (D1).
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeAdjustmentsRwPw.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Warehouse,
  Location,
  Product,
  StockMove,
} = require('../src/models');

const inventoryService = require('../src/services/wms/inventoryService');
const adjustmentService = require('../src/services/wms/adjustmentService');

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

    const company = await Company.create({ name: 'RW PW Smoke Company' }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'RWPW-WH',
        name: 'RW PW Warehouse',
        isActive: true,
      },
      { transaction: t }
    );

    const location = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'RWPW-A1',
        type: 'bulk',
      },
      { transaction: t }
    );

    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'RW PW Smoke Product',
        slug: `rw-pw-smoke-${Date.now()}`,
        sku: 'RW-PW-SKU',
        cost: 20, // PW resolver falls back to Product.cost when AdjustmentItem.unitCost is null
        currency: 'PLN',
      },
      { transaction: t }
    );

    // G1.3: PW creates its own cost_layer (incoming), but RW (outgoing) is blocked unless
    // the company has costingInitializedAt set. The flag is exclusively writable via the
    // openingBalanceService in real life; the smoke skips the init flow by setting the flag
    // directly because it exercises only the PW/RW round-trip.
    const { CompanyWarehouseDocumentSetting } = require('../src/models');
    await CompanyWarehouseDocumentSetting.create(
      { companyId, costingInitializedAt: new Date() },
      { transaction: t }
    );

    const pwDraft = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        documentType: 'PW',
        reason: 'Smoke PW +10',
        items: [
          {
            productId: product.id,
            variantId: null,
            locationId: location.id,
            lotId: null,
            qtyDelta: 10,
          },
        ],
      },
      t
    );

    check('PW create returns draft document', pwDraft && pwDraft.status === 'draft', `status=${pwDraft?.status}`);
    check('PW create returns number', Boolean(pwDraft?.number), `number=${pwDraft?.number || 'null'}`);

    const pwPosted = await adjustmentService.post(companyId, pwDraft.id, t);
    check('PW post returns posted status', pwPosted && pwPosted.status === 'posted', `status=${pwPosted?.status}`);

    const onHandAfterPw = await inventoryService.getOnHand(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        variantId: null,
      },
      { transaction: t }
    );
    check('PW +10 increases onHand to 10', Number(onHandAfterPw) === 10, `onHand=${onHandAfterPw}`);

    const pwItemId = pwPosted.items[0].id;
    const pwMovesCountBeforeRepeat = await StockMove.count({
      where: {
        companyId,
        type: 'adjustment',
        refType: 'PW',
        refId: pwPosted.id,
        refItemId: pwItemId,
      },
      transaction: t,
    });
    check('PW post creates one stock_move by refItemId', pwMovesCountBeforeRepeat === 1, `moves=${pwMovesCountBeforeRepeat}`);

    await adjustmentService.post(companyId, pwDraft.id, t);

    const onHandAfterPwRepeat = await inventoryService.getOnHand(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        variantId: null,
      },
      { transaction: t }
    );
    const pwMovesCountAfterRepeat = await StockMove.count({
      where: {
        companyId,
        type: 'adjustment',
        refType: 'PW',
        refId: pwPosted.id,
        refItemId: pwItemId,
      },
      transaction: t,
    });

    check('PW repeat post does not duplicate onHand', Number(onHandAfterPwRepeat) === 10, `onHand=${onHandAfterPwRepeat}`);
    check(
      'PW repeat post does not duplicate stock_moves',
      pwMovesCountAfterRepeat === pwMovesCountBeforeRepeat,
      `before=${pwMovesCountBeforeRepeat}, after=${pwMovesCountAfterRepeat}`
    );

    const rwDraft = await adjustmentService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        documentType: 'RW',
        reason: 'Smoke RW -3',
        items: [
          {
            productId: product.id,
            variantId: null,
            locationId: location.id,
            lotId: null,
            qtyDelta: -3,
          },
        ],
      },
      t
    );

    const rwPosted = await adjustmentService.post(companyId, rwDraft.id, t);
    check('RW post returns posted status', rwPosted && rwPosted.status === 'posted', `status=${rwPosted?.status}`);

    const onHandAfterRw = await inventoryService.getOnHand(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        variantId: null,
      },
      { transaction: t }
    );
    check('RW -3 decreases onHand 10 -> 7', Number(onHandAfterRw) === 7, `onHand=${onHandAfterRw}`);

    const rwItemId = rwPosted.items[0].id;
    const rwMovesBeforeRepeat = await StockMove.count({
      where: {
        companyId,
        type: 'adjustment',
        refType: 'RW',
        refId: rwPosted.id,
        refItemId: rwItemId,
      },
      transaction: t,
    });

    await adjustmentService.post(companyId, rwDraft.id, t);

    const onHandAfterRwRepeat = await inventoryService.getOnHand(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        variantId: null,
      },
      { transaction: t }
    );
    const rwMovesAfterRepeat = await StockMove.count({
      where: {
        companyId,
        type: 'adjustment',
        refType: 'RW',
        refId: rwPosted.id,
        refItemId: rwItemId,
      },
      transaction: t,
    });

    check('RW repeat post does not duplicate onHand', Number(onHandAfterRwRepeat) === 7, `onHand=${onHandAfterRwRepeat}`);
    check('RW repeat post does not duplicate stock_moves', rwMovesAfterRepeat === rwMovesBeforeRepeat, `before=${rwMovesBeforeRepeat}, after=${rwMovesAfterRepeat}`);

    const pwHistory = await adjustmentService.listStockMoves(companyId, pwPosted.id, { page: 1, limit: 20 }, { transaction: t });
    check('PW history by adjustment works', pwHistory && pwHistory.rows.length === 1, `rows=${pwHistory?.rows?.length}`);

    const rwHistory = await adjustmentService.listStockMoves(companyId, rwPosted.id, { page: 1, limit: 20 }, { transaction: t });
    check('RW history by adjustment works', rwHistory && rwHistory.rows.length === 1, `rows=${rwHistory?.rows?.length}`);
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
