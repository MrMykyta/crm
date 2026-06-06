'use strict';

// A2 — Line item foundation smoke.
// NON-DESTRUCTIVE: all writes happen inside a single transaction that is ALWAYS rolled back.
//
// Coverage:
//   1. Migration applied: products.is_service / offer_items.* / order_items.* / invoice_items exist.
//   2. PG ENUM type `product_service_line_type` exists with the expected 5 values.
//   3. Product.isService defaults to false; creating with isService=true round-trips.
//   4. OfferItem / OrderItem accept the new fields; backfill rule for new rows matches A3 intent.
//   5. InvoiceItem CRUD: create, hasMany Invoice→items association loads, paranoid soft-delete works.
//   6. Backfill smoke: insert a legacy-shape row (no new fields set), then run the same backfill
//      SQL inside the txn and verify line_type/affects_inventory derive correctly.
//
// Run:
//   docker compose exec backend node scripts/smokeLineItemFoundation.js

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Counterparty,
  Invoice,
  InvoiceItem,
  Offer,
  OfferItem,
  Order,
  OrderItem,
  Product,
  TaxCategory,
} = require('../src/models');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

function n(v) { return Number(v); }

async function describe(table) {
  return sequelize.getQueryInterface().describeTable(table);
}

(async () => {
  let t;
  try {
    await sequelize.authenticate();

    // ------------------------------------------------------------------
    // 1) Schema introspection — outside the transaction so we read committed metadata.
    // ------------------------------------------------------------------
    const productCols = await describe('products');
    check('products.is_service column exists', Boolean(productCols.is_service),
      `present=${Boolean(productCols.is_service)}`);

    const offerCols = await describe('offer_items');
    for (const col of ['line_type', 'affects_inventory', 'is_stock_tracked_snapshot', 'tax_category_id', 'parent_line_item_id']) {
      check(`offer_items.${col} exists`, Boolean(offerCols[col]));
    }
    const orderCols = await describe('order_items');
    for (const col of ['line_type', 'affects_inventory', 'is_stock_tracked_snapshot', 'tax_category_id', 'parent_line_item_id']) {
      check(`order_items.${col} exists`, Boolean(orderCols[col]));
    }
    const invoiceItemCols = await describe('invoice_items');
    for (const col of [
      'id', 'company_id', 'invoice_id', 'order_item_id', 'product_id', 'variant_id',
      'tax_category_id', 'parent_line_item_id', 'line_type', 'affects_inventory',
      'is_stock_tracked_snapshot', 'name_snapshot', 'qty', 'price_net', 'tax_rate',
      'line_total_gross', 'deleted_at',
    ]) {
      check(`invoice_items.${col} exists`, Boolean(invoiceItemCols[col]));
    }

    // ENUM type sanity.
    const [enumRows] = await sequelize.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'product_service_line_type')
      ORDER BY enumsortorder ASC
    `);
    const enumLabels = enumRows.map((r) => r.enumlabel).join(',');
    check('product_service_line_type ENUM has 5 expected values',
      enumLabels === 'product,service,custom,fee,discount', `labels=${enumLabels}`);

    // ------------------------------------------------------------------
    // 2) Now open the transaction for DML smoke.
    // ------------------------------------------------------------------
    t = await sequelize.transaction();
    const suffix = Date.now();
    const company = await Company.create({ name: `A2 LineItem Smoke ${suffix}` }, { transaction: t });
    const companyId = company.id;

    // 3) Product.isService default + explicit true round-trip.
    const stockedProduct = await Product.create({
      id: crypto.randomUUID(),
      companyId,
      name: 'A2 stocked product',
      slug: `a2-prod-${suffix}`,
      sku: 'A2-P1',
      trackInventory: true,
    }, { transaction: t });
    const stockedReload = await Product.findByPk(stockedProduct.id, { transaction: t });
    check('Product default isService=false', stockedReload.isService === false,
      `isService=${stockedReload.isService}`);

    const serviceProduct = await Product.create({
      id: crypto.randomUUID(),
      companyId,
      name: 'A2 service product',
      slug: `a2-svc-${suffix}`,
      sku: 'A2-S1',
      trackInventory: false,
      isService: true,
    }, { transaction: t });
    check('Product isService=true round-trips',
      (await Product.findByPk(serviceProduct.id, { transaction: t })).isService === true);

    // 4) Tax category for FK round-trip.
    const taxCat = await TaxCategory.create({
      id: crypto.randomUUID(),
      companyId,
      code: `A2-VAT-${suffix}`,
      name: 'A2 VAT 23',
      rate: 23,
    }, { transaction: t });

    // 5) Counterparty + Offer/OfferItem with new fields populated.
    const counterparty = await Counterparty.create({
      id: crypto.randomUUID(),
      companyId,
      name: `Cpt A2 ${suffix}`,
      shortName: `Cpt-${suffix}`,
      type: 'client',
    }, { transaction: t });

    const offer = await Offer.create({
      id: crypto.randomUUID(),
      companyId,
      number: `OF-A2-${suffix}`,
      counterpartyId: counterparty.id,
      status: 'draft',
      currency: 'PLN',
    }, { transaction: t });

    const offerItemA = await OfferItem.create({
      id: crypto.randomUUID(),
      companyId,
      offerId: offer.id,
      productId: stockedProduct.id,
      qty: 2,
      priceNet: 100,
      priceGross: 123,
      taxRate: 23,
      taxCategoryId: taxCat.id,
      lineType: 'product',
      affectsInventory: true,
      isStockTrackedSnapshot: true,
      nameSnapshot: 'A2 stocked product',
      lineSubtotalNet: 200,
      lineVat: 46,
      lineTotalGross: 246,
    }, { transaction: t });
    const offerItemReload = await OfferItem.findByPk(offerItemA.id, { transaction: t });
    check('OfferItem lineType=product persists',
      offerItemReload.lineType === 'product');
    check('OfferItem affectsInventory=true persists',
      offerItemReload.affectsInventory === true);
    check('OfferItem isStockTrackedSnapshot=true persists',
      offerItemReload.isStockTrackedSnapshot === true);
    check('OfferItem taxCategoryId persists',
      offerItemReload.taxCategoryId === taxCat.id);

    // 6) Order/OrderItem with service line.
    const order = await Order.create({
      id: crypto.randomUUID(),
      companyId,
      number: `ORD-A2-${suffix}`,
      customerId: counterparty.id,
      status: 'draft',
      paymentStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      currencyCode: 'PLN',
    }, { transaction: t });

    const orderServiceLine = await OrderItem.create({
      id: crypto.randomUUID(),
      companyId,
      orderId: order.id,
      productId: serviceProduct.id,
      qty: 1,
      priceNet: 300,
      priceGross: 369,
      taxRate: 23,
      lineType: 'service',
      affectsInventory: false,
      isStockTrackedSnapshot: false,
      nameSnapshot: 'A2 service product',
      lineSubtotalNet: 300,
      lineVat: 69,
      lineTotalGross: 369,
    }, { transaction: t });
    const orderServiceReload = await OrderItem.findByPk(orderServiceLine.id, { transaction: t });
    check('OrderItem service line lineType=service persists',
      orderServiceReload.lineType === 'service');
    check('OrderItem service line affectsInventory=false persists',
      orderServiceReload.affectsInventory === false);

    // 7) Invoice + InvoiceItem CRUD + association.
    const invoice = await Invoice.create({
      id: crypto.randomUUID(),
      companyId,
      orderId: order.id,
      number: `INV-A2-${suffix}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      totalNet: 300,
      totalTax: 69,
      totalGross: 369,
    }, { transaction: t });

    const invoiceItem = await InvoiceItem.create({
      id: crypto.randomUUID(),
      companyId,
      invoiceId: invoice.id,
      orderItemId: orderServiceLine.id,
      productId: serviceProduct.id,
      taxCategoryId: taxCat.id,
      lineType: 'service',
      affectsInventory: false,
      isStockTrackedSnapshot: false,
      nameSnapshot: 'A2 service product',
      qty: 1,
      priceNet: 300,
      priceGross: 369,
      taxRate: 23,
      lineSubtotalNet: 300,
      lineVat: 69,
      lineTotalNet: 300,
      lineTotalGross: 369,
    }, { transaction: t });
    check('InvoiceItem persisted with lineType=service',
      invoiceItem.lineType === 'service');

    const invoiceWithItems = await Invoice.findByPk(invoice.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
      transaction: t,
    });
    check('Invoice.hasMany(InvoiceItem) association loads',
      Array.isArray(invoiceWithItems.items)
        && invoiceWithItems.items.length === 1
        && invoiceWithItems.items[0].id === invoiceItem.id,
      `items=${invoiceWithItems.items.length}`);

    // 8) Paranoid soft-delete on InvoiceItem.
    await invoiceItem.destroy({ transaction: t });
    const stillVisible = await InvoiceItem.findByPk(invoiceItem.id, { transaction: t });
    check('InvoiceItem paranoid: soft-deleted row hidden by default',
      stillVisible === null);
    const withParanoid = await InvoiceItem.findByPk(invoiceItem.id, { transaction: t, paranoid: false });
    check('InvoiceItem paranoid: row still present with paranoid=false',
      withParanoid !== null && withParanoid.deletedAt instanceof Date);

    // 9) Backfill SQL smoke. Insert a "legacy" offer_items row with explicit-default values
    //    and run the same backfill block from the migration. Assert classification.
    const legacyCustomLine = await OfferItem.create({
      id: crypto.randomUUID(),
      companyId,
      offerId: offer.id,
      productId: null,
      qty: 1,
      priceNet: 50,
      priceGross: 50,
      taxRate: 0,
      nameSnapshot: 'A2 custom line',
      isCustomLine: true,
      // explicitly reset the new columns to defaults to simulate pre-backfill state
      lineType: 'product',
      affectsInventory: false,
      isStockTrackedSnapshot: false,
    }, { transaction: t });
    const legacyServiceLine = await OfferItem.create({
      id: crypto.randomUUID(),
      companyId,
      offerId: offer.id,
      productId: serviceProduct.id,
      qty: 1,
      priceNet: 100,
      priceGross: 123,
      taxRate: 23,
      nameSnapshot: 'A2 svc',
      lineType: 'product',
      affectsInventory: false,
      isStockTrackedSnapshot: false,
    }, { transaction: t });
    const legacyStockedLine = await OfferItem.create({
      id: crypto.randomUUID(),
      companyId,
      offerId: offer.id,
      productId: stockedProduct.id,
      qty: 1,
      priceNet: 100,
      priceGross: 123,
      taxRate: 23,
      nameSnapshot: 'A2 stocked',
      lineType: 'product',
      affectsInventory: false,
      isStockTrackedSnapshot: false,
    }, { transaction: t });

    await sequelize.query(`
      UPDATE offer_items AS it
      SET
        line_type = CASE
          WHEN it.product_id IS NULL OR it.is_custom_line = true
            THEN 'custom'::"product_service_line_type"
          WHEN p.is_service = true
            THEN 'service'::"product_service_line_type"
          ELSE 'product'::"product_service_line_type"
        END,
        is_stock_tracked_snapshot = COALESCE(p.track_inventory, false),
        affects_inventory = CASE
          WHEN it.product_id IS NULL OR it.is_custom_line = true THEN false
          WHEN p.is_service = true THEN false
          ELSE COALESCE(p.track_inventory, false)
        END
      FROM offer_items AS it2
      LEFT JOIN products p ON p.id = it2.product_id
      WHERE it.id = it2.id
        AND it.id IN (:ids);
    `, {
      replacements: { ids: [legacyCustomLine.id, legacyServiceLine.id, legacyStockedLine.id] },
      transaction: t,
    });

    const customReloaded = await OfferItem.findByPk(legacyCustomLine.id, { transaction: t });
    const serviceReloaded = await OfferItem.findByPk(legacyServiceLine.id, { transaction: t });
    const stockedReloaded = await OfferItem.findByPk(legacyStockedLine.id, { transaction: t });

    check('Backfill: custom line classified as line_type=custom, affects_inventory=false',
      customReloaded.lineType === 'custom' && customReloaded.affectsInventory === false);
    check('Backfill: service product classified as line_type=service, affects_inventory=false',
      serviceReloaded.lineType === 'service' && serviceReloaded.affectsInventory === false
        && serviceReloaded.isStockTrackedSnapshot === false,
      `lineType=${serviceReloaded.lineType} affects=${serviceReloaded.affectsInventory} stocked=${serviceReloaded.isStockTrackedSnapshot}`);
    check('Backfill: stocked product classified as line_type=product, affects_inventory=true, isStockTrackedSnapshot=true',
      stockedReloaded.lineType === 'product'
        && stockedReloaded.affectsInventory === true
        && stockedReloaded.isStockTrackedSnapshot === true,
      `lineType=${stockedReloaded.lineType} affects=${stockedReloaded.affectsInventory} stocked=${stockedReloaded.isStockTrackedSnapshot}`);

    // 10) Self-FK parent_line_item_id stores a valid offer_items.id without error.
    const childOfStocked = await OfferItem.create({
      id: crypto.randomUUID(),
      companyId,
      offerId: offer.id,
      productId: null,
      qty: 1,
      priceNet: 10,
      priceGross: 10,
      taxRate: 0,
      nameSnapshot: 'A2 discount on stocked',
      lineType: 'discount',
      affectsInventory: false,
      isStockTrackedSnapshot: false,
      isCustomLine: true,
      parentLineItemId: stockedReloaded.id,
    }, { transaction: t });
    check('OfferItem.parentLineItemId self-FK accepts a real parent',
      childOfStocked.parentLineItemId === stockedReloaded.id);

    // ENUM rejection sanity: trying to insert an invalid line_type should throw.
    let enumErrorCode = null;
    try {
      await sequelize.query(`
        INSERT INTO offer_items (
          id, company_id, offer_id, qty, price_net, price_gross, tax_rate,
          line_subtotal_net, line_vat, line_total_gross,
          line_type, name_snapshot, sort_order,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), :cid, :oid, 1, 0, 0, 0,
          0, 0, 0,
          'bogus'::text::"product_service_line_type", 'bogus', 0,
          NOW(), NOW()
        );
      `, {
        replacements: { cid: companyId, oid: offer.id },
        transaction: t,
      });
    } catch (err) {
      enumErrorCode = err && err.original ? err.original.code : err.code;
    }
    check('ENUM rejects unknown line_type value (22P02)', enumErrorCode === '22P02',
      `code=${enumErrorCode}`);
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

  const failed = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})();
