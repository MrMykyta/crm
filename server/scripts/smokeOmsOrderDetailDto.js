'use strict';

const crypto = require('crypto');
const {
  sequelize,
  Company,
  User,
  UserCompany,
  Counterparty,
  Product,
  Warehouse,
  OrderItem,
  OrderEvent,
  Shipment,
  ShipmentItem,
  Reservation,
  Payment,
  Invoice,
  CreditNote,
} = require('../src/models');
const orderService = require('../src/services/oms/orderService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function allCountsNumeric(counts = {}) {
  return ['shipments', 'reservations', 'invoices', 'payments', 'creditNotes', 'events']
    .every((key) => Number.isFinite(Number(counts[key])));
}

(async () => {
  let tx;
  try {
    await sequelize.authenticate();
    tx = await sequelize.transaction();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await User.create({
      id: crypto.randomUUID(),
      email: `oms-order-dto-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: tx });

    const company = await Company.create({
      id: crypto.randomUUID(),
      name: `OMS Order DTO Smoke ${suffix}`,
      ownerUserId: owner.id,
    }, { transaction: tx });

    await UserCompany.create({
      id: crypto.randomUUID(),
      userId: owner.id,
      companyId: company.id,
      role: 'owner',
      status: 'active',
    }, { transaction: tx });

    const counterparty = await Counterparty.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      shortName: `DTO Customer ${suffix}`.slice(0, 120),
      fullName: `DTO Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
    }, { transaction: tx });

    const product = await Product.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      name: `DTO Product ${suffix}`,
      slug: `dto-product-${suffix}`,
      sku: `DTO-${suffix}`.slice(0, 64),
      status: 'active',
      currency: 'PLN',
      price: 100,
      trackInventory: false,
    }, { transaction: tx });

    const warehouse = await Warehouse.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      code: `DTO-${String(Date.now()).slice(-6)}`,
      name: 'DTO Warehouse',
      isActive: true,
    }, { transaction: tx });

    const ctx = { id: owner.id, userId: owner.id, companyId: company.id, transaction: tx };
    const order = await orderService.createOrder({
      number: `DTO-ORDER-${suffix}`,
      counterpartyId: counterparty.id,
      ownerId: owner.id,
      currencyCode: 'PLN',
      status: 'new',
      items: [
        {
          productId: product.id,
          quantity: 2,
          unitPriceNet: 100,
          taxRate: 23,
        },
      ],
    }, ctx, { transaction: tx });

    const orderItem = await OrderItem.findOne({
      where: { companyId: company.id, orderId: order.id },
      transaction: tx,
    });
    check('Disposable order item created', Boolean(orderItem?.id), `orderItem=${orderItem?.id || 'null'}`);

    await OrderEvent.create({
      companyId: company.id,
      orderId: order.id,
      actorId: owner.id,
      type: 'status_change',
      message: 'Disposable status change event',
    }, { transaction: tx });

    const shipment = await Shipment.create({
      companyId: company.id,
      warehouseId: warehouse.id,
      orderId: order.id,
      number: `DTO-WZ-${suffix}`.slice(0, 100),
      status: 'packing',
    }, { transaction: tx });
    await ShipmentItem.create({
      shipmentId: shipment.id,
      productId: product.id,
      variantId: null,
      qty: 2,
    }, { transaction: tx });

    await Reservation.create({
      companyId: company.id,
      orderId: order.id,
      orderItemId: orderItem.id,
      warehouseId: warehouse.id,
      productId: product.id,
      variantId: null,
      qty: 2,
      status: 'active',
    }, { transaction: tx });

    const invoice = await Invoice.create({
      companyId: company.id,
      orderId: order.id,
      number: `DTO-INV-${suffix}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      totalNet: order.totalNet,
      totalTax: order.totalTax,
      totalGross: order.totalGross,
    }, { transaction: tx });

    await Payment.create({
      companyId: company.id,
      orderId: order.id,
      method: 'bank_transfer',
      status: 'paid',
      amount: 100,
      transactionId: `DTO-PAY-${suffix}`,
      processedAt: new Date(),
    }, { transaction: tx });

    await CreditNote.create({
      companyId: company.id,
      invoiceId: invoice.id,
      amountNet: 10,
      amountTax: 2.3,
      amountGross: 12.3,
      reason: 'Disposable DTO smoke credit note',
    }, { transaction: tx });

    const detail = await orderService.getOrderById(order.id, ctx);

    check('events is array', Array.isArray(detail.events), `events=${detail.events?.length}`);
    check('shipments is array', Array.isArray(detail.shipments), `shipments=${detail.shipments?.length}`);
    check('reservations is array', Array.isArray(detail.reservations), `reservations=${detail.reservations?.length}`);
    check('payments is array', Array.isArray(detail.payments), `payments=${detail.payments?.length}`);
    check('invoices is array', Array.isArray(detail.invoices), `invoices=${detail.invoices?.length}`);
    check('creditNotes is array', Array.isArray(detail.creditNotes), `creditNotes=${detail.creditNotes?.length}`);
    check('counts exists and numeric', allCountsNumeric(detail.counts), JSON.stringify(detail.counts || {}));
    check('amountPaid exists', Number.isFinite(Number(detail.amountPaid)), `amountPaid=${detail.amountPaid}`);
    check('amountDue exists', Number.isFinite(Number(detail.amountDue)), `amountDue=${detail.amountDue}`);
    check('amountPaid uses paid/authorized payments', money(detail.amountPaid) === 100, `amountPaid=${detail.amountPaid}`);
    check('amountDue does not break total gross', money(detail.amountDue) === money(Number(detail.totalGross) - 100), `amountDue=${detail.amountDue}`);
    check('event row surfaced', detail.events.length === 1 && detail.events[0].label, `label=${detail.events?.[0]?.label || 'null'}`);
    check('shipment row surfaced', detail.shipments.length === 1 && detail.shipments[0].items.length === 1);
    check('reservation row surfaced', detail.reservations.length === 1 && detail.reservations[0].product?.id === product.id);
    check('payment row surfaced', detail.payments.length === 1 && money(detail.payments[0].amount) === 100);
    check('credit note row surfaced', detail.creditNotes.length === 1 && detail.creditNotes[0].invoiceId === invoice.id);

    await tx.rollback();
    tx = null;
    check('Disposable DTO data rolled back', true);

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      process.exitCode = 1;
      // eslint-disable-next-line no-console
      console.error(`OMS order detail DTO smoke failed: ${failed.length} failing check(s)`);
    } else {
      // eslint-disable-next-line no-console
      console.log('OMS order detail DTO smoke passed');
    }
  } catch (error) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('OMS order detail DTO smoke failed:', error);
    if (tx && !tx.finished) {
      await tx.rollback().catch((rollbackError) => {
        // eslint-disable-next-line no-console
        console.error('OMS order detail DTO rollback failed:', rollbackError);
      });
    }
  } finally {
    await sequelize.close();
  }
})();
