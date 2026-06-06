'use strict';

// Standalone runtime smoke for WZ shipment backend (B1/B2).
// NON-DESTRUCTIVE: all operations run in one transaction and are ALWAYS rolled back.
// Run in backend container:
//   docker exec crm_backend node scripts/smokeShipmentWz.js

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
const shipmentService = require('../src/services/wms/shipmentService');
const stockMoveService = require('../src/services/wms/stockMoveService');

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

    const company = await Company.create({ name: 'WZ Smoke Company' }, { transaction: t });
    const companyId = company.id;

    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId,
        code: 'WZ-SMOKE-WH',
        name: 'WZ Smoke Warehouse',
        isActive: true,
      },
      { transaction: t }
    );

    const locA = await Location.create(
      {
        id: crypto.randomUUID(),
        companyId,
        warehouseId: warehouse.id,
        code: 'WZ-A',
        type: 'bulk',
      },
      { transaction: t }
    );

    const product = await Product.create(
      {
        id: crypto.randomUUID(),
        companyId,
        name: 'WZ Smoke Product',
        slug: `wz-smoke-product-${Date.now()}`,
        sku: 'WZ-SKU-1',
        cost: 20, // unit cost used by opening-balance init below (G1.3 wiring)
      },
      { transaction: t }
    );

    await inventoryService.applyMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: warehouse.id,
        toLocationId: locA.id,
        productId: product.id,
        variantId: null,
        qty: 10,
        refType: 'TEST',
        refId: crypto.randomUUID(),
        refItemId: crypto.randomUUID(),
      },
      { transaction: t }
    );

    // G1.3: seeding via inventoryService.applyMove bypasses receiptService and creates no
    // cost_layer. Run opening-balance init to materialize an OPENING layer from current
    // qty_on_hand AND flip the costingInitializedAt gate, so subsequent WZ.shipItem works.
    const openingBalanceService = require('../src/services/wms/costingOpeningBalanceService');
    await openingBalanceService.initializeForCompany(companyId, {}, { transaction: t });

    const shipment = await shipmentService.create(
      companyId,
      {
        warehouseId: warehouse.id,
        items: [{ productId: product.id, variantId: null, qty: 4 }],
      },
      t
    );

    check('WZ create returns number', Boolean(shipment?.number), `number=${shipment?.number || 'null'}`);
    check('WZ create returns one item', Array.isArray(shipment?.items) && shipment.items.length === 1, `items=${shipment?.items?.length}`);

    const shipmentItem = shipment.items[0];

    const shipped = await shipmentService.shipItem(
      companyId,
      shipmentItem.id,
      {
        qty: 4,
        fromLocationId: locA.id,
      },
      t
    );
    check('WZ ship item returns row', Boolean(shipped?.id));

    const onHandAfterShip = await inventoryService.getOnHand(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        variantId: null,
      },
      { transaction: t }
    );
    check('WZ shipping decreases onHand 10 -> 6', Number(onHandAfterShip) === 6, `onHand=${onHandAfterShip}`);

    const movedRowsBeforeRepeat = await StockMove.count({
      where: {
        companyId,
        refType: 'WZ',
        refId: shipment.id,
        refItemId: shipmentItem.id,
        type: 'ship',
      },
      transaction: t,
    });

    await shipmentService.shipItem(
      companyId,
      shipmentItem.id,
      {
        qty: 1,
        fromLocationId: locA.id,
      },
      t
    );

    const onHandAfterRepeat = await inventoryService.getOnHand(
      {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        variantId: null,
      },
      { transaction: t }
    );

    const movedRowsAfterRepeat = await StockMove.count({
      where: {
        companyId,
        refType: 'WZ',
        refId: shipment.id,
        refItemId: shipmentItem.id,
        type: 'ship',
      },
      transaction: t,
    });

    check('Repeat ship on closed line does not change onHand', Number(onHandAfterRepeat) === 6, `onHand=${onHandAfterRepeat}`);
    check('Repeat ship on closed line does not create duplicate move', movedRowsAfterRepeat === movedRowsBeforeRepeat, `before=${movedRowsBeforeRepeat}, after=${movedRowsAfterRepeat}`);

    const list = await shipmentService.list(companyId, { page: 1, limit: 20 }, { transaction: t });
    check('WZ list includes created shipment', list.rows.some((row) => row.id === shipment.id), `count=${list.count}`);

    const detail = await shipmentService.getById(companyId, shipment.id, { transaction: t });
    check('WZ detail includes items', detail && Array.isArray(detail.items) && detail.items.length === 1, `items=${detail?.items?.length}`);

    const historyByDoc = await shipmentService.listStockMoves(companyId, shipment.id, { page: 1, limit: 20 }, { transaction: t });
    check('WZ history by document', historyByDoc && historyByDoc.rows.length === 1, `rows=${historyByDoc?.rows?.length}`);

    const historyByLine = await shipmentService.listItemStockMoves(companyId, shipmentItem.id, { page: 1, limit: 20 }, { transaction: t });
    check('WZ history by refItemId', historyByLine && historyByLine.rows.length === 1, `rows=${historyByLine?.rows?.length}`);

    const genericHistoryByDoc = await stockMoveService.listHistoryByDocument({
      companyId,
      refType: 'WZ',
      refId: shipment.id,
      page: 1,
      limit: 20,
      transaction: t,
    });
    check('Generic history by document (WZ)', genericHistoryByDoc.rows.length === 1, `rows=${genericHistoryByDoc.rows.length}`);

    const genericHistoryByItem = await stockMoveService.listHistoryByDocument({
      companyId,
      refType: 'WZ',
      refId: shipment.id,
      refItemId: shipmentItem.id,
      page: 1,
      limit: 20,
      transaction: t,
    });
    check('Generic history by document + refItemId (WZ)', genericHistoryByItem.rows.length === 1, `rows=${genericHistoryByItem.rows.length}`);
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
