'use strict';

// Runtime smoke for WMS-POLICY-2C-1 PZ receive without inbound location.
//
// The script runs inside one transaction and always rolls back.
//
// Run:
//   node scripts/smokePzReceiveWithoutLocation.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Warehouse,
  Location,
  Product,
  Receipt,
  ReceiptItem,
  InventoryItem,
  StockMove,
} = require('../src/models');
const receiptService = require('../src/services/wms/receiptService');
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

async function createReceiptWithItems({ companyId, warehouseId, inboundLocationId, productId, qtys, number, transaction }) {
  const receipt = await Receipt.create(
    {
      companyId,
      warehouseId,
      inboundLocationId,
      number,
      status: 'draft',
    },
    { transaction }
  );

  const items = [];
  for (const qty of qtys) {
    // eslint-disable-next-line no-await-in-loop
    const item = await ReceiptItem.create(
      {
        receiptId: receipt.id,
        productId,
        variantId: null,
        qtyExpected: qty,
        qtyReceived: 0,
        unitCost: 5,
        currency: 'PLN',
      },
      { transaction }
    );
    items.push(item);
  }

  return { receipt, items };
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();
    t = await sequelize.transaction();

    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const company = await Company.create({ name: `Policy2C1 Smoke ${suffix}` }, { transaction: t });
    const warehouse = await Warehouse.create(
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        code: `P2C1-${suffix}`.slice(0, 32),
        name: 'Policy2C1 Warehouse',
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
    const product = await Product.create(
      {
        companyId: company.id,
        sku: `P2C1-${suffix}`.slice(0, 64),
        name: `Policy2C1 Product ${suffix}`,
        slug: `policy2c1-${suffix}`,
        status: 'active',
        trackInventory: true,
        isService: false,
      },
      { transaction: t }
    );

    const noLocation = await createReceiptWithItems({
      companyId: company.id,
      warehouseId: warehouse.id,
      inboundLocationId: null,
      productId: product.id,
      qtys: [2, 3],
      number: `P2C1-NOLOC-${suffix}`.slice(0, 64),
      transaction: t,
    });

    const firstReceived = await receiptService.receiveLine(
      company.id,
      noLocation.items[0].id,
      { qty: 2 },
      t
    );
    check('PZ receive line without inbound location updates qtyReceived', asNumber(firstReceived.qtyReceived) === 2);

    await receiptService.receiveLine(company.id, noLocation.items[1].id, { qty: 3 }, t);
    const noLocationReloaded = await Receipt.findByPk(noLocation.receipt.id, { transaction: t });
    check('PZ receive all lines without inbound location closes receipt', noLocationReloaded.status === 'received');

    const warehouseLevelQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: null,
      productId: product.id,
      transaction: t,
    });
    check('PZ without location creates warehouse-level InventoryItem', warehouseLevelQty === 5, `qty=${warehouseLevelQty}`);

    const noLocationMoves = await StockMove.findAll({
      where: {
        companyId: company.id,
        refType: 'PZ',
        refId: noLocation.receipt.id,
        type: 'receipt',
      },
      order: [['createdAt', 'ASC']],
      transaction: t,
    });
    check(
      'PZ without location writes StockMove.toLocationId=null',
      noLocationMoves.length === 2 && noLocationMoves.every((move) => move.toLocationId === null),
      `moves=${noLocationMoves.length}`
    );

    const balances = await stockBalanceService.listStockBalances(
      company.id,
      { warehouseId: warehouse.id, productId: product.id },
      { transaction: t }
    );
    const balanceRow = balances.find((row) => row.productId === product.id && row.warehouseId === warehouse.id);
    check('PZ without location updates stock balance', balanceRow && asNumber(balanceRow.onHand) === 5, `onHand=${balanceRow?.onHand}`);

    const withLocation = await createReceiptWithItems({
      companyId: company.id,
      warehouseId: warehouse.id,
      inboundLocationId: location.id,
      productId: product.id,
      qtys: [4],
      number: `P2C1-LOC-${suffix}`.slice(0, 64),
      transaction: t,
    });
    await receiptService.receiveLine(company.id, withLocation.items[0].id, { qty: 4 }, t);

    const locationLevelQty = await inventoryQty({
      companyId: company.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      productId: product.id,
      transaction: t,
    });
    check('PZ with inbound location still creates location-level InventoryItem', locationLevelQty === 4, `qty=${locationLevelQty}`);

    const locationMove = await StockMove.findOne({
      where: {
        companyId: company.id,
        refType: 'PZ',
        refId: withLocation.receipt.id,
        type: 'receipt',
      },
      transaction: t,
    });
    check('PZ with inbound location still writes StockMove.toLocationId', locationMove?.toLocationId === location.id);
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
