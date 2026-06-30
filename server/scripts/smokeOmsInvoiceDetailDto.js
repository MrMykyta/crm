'use strict';

const crypto = require('crypto');
const {
  sequelize,
  Company,
  User,
  UserCompany,
  Counterparty,
  Product,
  Payment,
} = require('../src/models');
const orderService = require('../src/services/oms/orderService');
const invoiceService = require('../src/services/oms/invoiceService');

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

(async () => {
  let tx;
  try {
    await sequelize.authenticate();
    tx = await sequelize.transaction();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await User.create({
      id: crypto.randomUUID(),
      email: `oms-invoice-dto-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: tx });

    const company = await Company.create({
      id: crypto.randomUUID(),
      name: `OMS Invoice DTO Smoke ${suffix}`,
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
      shortName: `Invoice DTO Customer ${suffix}`.slice(0, 120),
      fullName: `Invoice DTO Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
    }, { transaction: tx });

    const product = await Product.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      name: `Invoice DTO Product ${suffix}`,
      slug: `invoice-dto-product-${suffix}`,
      sku: `INV-DTO-${suffix}`.slice(0, 64),
      status: 'active',
      currency: 'PLN',
      price: 100,
      trackInventory: false,
    }, { transaction: tx });

    const ctx = { id: owner.id, userId: owner.id, companyId: company.id, transaction: tx };
    const order = await orderService.createOrder({
      number: `DTO-INV-ORDER-${suffix}`,
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

    const invoice = await invoiceService.issue(order.id, {
      number: `DTO-INV-${suffix}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    }, { transaction: tx });

    await Payment.create({
      companyId: company.id,
      orderId: order.id,
      method: 'bank_transfer',
      status: 'paid',
      amount: 100,
      transactionId: `DTO-INV-PAY-${suffix}`,
      processedAt: new Date(),
    }, { transaction: tx });

    const detail = await invoiceService.get(invoice.id, ctx);

    check('invoice detail exists', Boolean(detail?.id), `invoice=${detail?.id || 'null'}`);
    check('items is array', Array.isArray(detail.items), `items=${detail.items?.length}`);
    check('payments is array', Array.isArray(detail.payments), `payments=${detail.payments?.length}`);
    check('amountPaid exists', Number.isFinite(Number(detail.amountPaid)), `amountPaid=${detail.amountPaid}`);
    check('amountDue exists', Number.isFinite(Number(detail.amountDue)), `amountDue=${detail.amountDue}`);
    check('amountPaid uses order payment rows', money(detail.amountPaid) === 100, `amountPaid=${detail.amountPaid}`);
    check(
      'amountDue is invoice total minus order payments',
      money(detail.amountDue) === money(Number(detail.totalGross) - 100),
      `amountDue=${detail.amountDue}, totalGross=${detail.totalGross}`
    );
    check('overdue is true when due date is past and balance remains', detail.overdue === true);
    check('paymentState reflects partial overdue payment', detail.paymentState === 'partially_paid_overdue', `paymentState=${detail.paymentState}`);
    check('payment source caveat is order-scoped', detail.paymentSource?.scope === 'order');
    check('order summary includes customer and totals', Boolean(detail.order?.counterparty?.id) && money(detail.order?.totalGross) === money(order.totalGross));
    check('VAT breakdown is present', Array.isArray(detail.vatBreakdown) && detail.vatBreakdown.length === 1);
    check('VAT rate is copied from invoice items', money(detail.vatBreakdown?.[0]?.rate) === 23, `rate=${detail.vatBreakdown?.[0]?.rate}`);
    check('availableActions is additive object', detail.availableActions && typeof detail.availableActions === 'object');
    check('unsupported register payment action is not enabled', detail.availableActions?.canRegisterPayment === false);
    check('creditNotes returns safe empty array', Array.isArray(detail.creditNotes) && detail.creditNotes.length === 0);

    await tx.rollback();
    tx = null;
    check('Disposable invoice DTO data rolled back', true);

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      process.exitCode = 1;
      // eslint-disable-next-line no-console
      console.error(`OMS invoice detail DTO smoke failed: ${failed.length} failing check(s)`);
    } else {
      // eslint-disable-next-line no-console
      console.log('OMS invoice detail DTO smoke passed');
    }
  } catch (error) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('OMS invoice detail DTO smoke failed:', error);
    if (tx && !tx.finished) {
      await tx.rollback().catch((rollbackError) => {
        // eslint-disable-next-line no-console
        console.error('OMS invoice detail DTO rollback failed:', rollbackError);
      });
    }
  } finally {
    await sequelize.close();
  }
})();
