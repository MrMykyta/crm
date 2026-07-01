'use strict';

const crypto = require('crypto');
const {
  sequelize,
  Company,
  User,
  UserCompany,
  Counterparty,
  Product,
  CreditNote,
} = require('../src/models');
const orderService = require('../src/services/oms/orderService');
const invoiceService = require('../src/services/oms/invoiceService');
const paymentService = require('../src/services/oms/paymentService');
const paymentLedgerService = require('../src/services/oms/paymentLedgerService');

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

async function expectFailure(name, fn) {
  try {
    await fn();
    check(name, false, 'expected failure but succeeded');
  } catch (error) {
    check(name, true, error?.code || error?.message || 'failed as expected');
  }
}

(async () => {
  let tx;
  try {
    await sequelize.authenticate();
    tx = await sequelize.transaction();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await User.create({
      id: crypto.randomUUID(),
      email: `oms-ledger-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: tx });

    const company = await Company.create({
      id: crypto.randomUUID(),
      name: `OMS Ledger Smoke ${suffix}`,
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
      shortName: `Ledger Customer ${suffix}`.slice(0, 120),
      fullName: `Ledger Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
    }, { transaction: tx });

    const product = await Product.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      name: `Ledger Product ${suffix}`,
      slug: `ledger-product-${suffix}`,
      sku: `LEDGER-${suffix}`.slice(0, 64),
      status: 'active',
      currency: 'PLN',
      price: 100,
      trackInventory: false,
    }, { transaction: tx });

    const ctx = { id: owner.id, userId: owner.id, companyId: company.id, transaction: tx };
    let orderSeq = 0;

    async function createOrderAndInvoice(quantity = 1) {
      orderSeq += 1;
      const order = await orderService.createOrder({
        number: `LEDGER-ORD-${orderSeq}-${suffix}`,
        counterpartyId: counterparty.id,
        ownerId: owner.id,
        currencyCode: 'PLN',
        status: 'new',
        items: [
          {
            productId: product.id,
            quantity,
            unitPriceNet: 100,
            taxRate: 23,
          },
        ],
      }, ctx, { transaction: tx });

      const invoice = await invoiceService.issue(order.id, {
        number: `LEDGER-INV-${orderSeq}-${suffix}`,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
      }, { transaction: tx });

      return { order, invoice };
    }

    const { order: partialOrder, invoice: partialInvoice } = await createOrderAndInvoice(2);
    const partialAmount = money(Number(partialInvoice.totalGross) * 0.4);
    await paymentService.create({
      companyId: company.id,
      orderId: partialOrder.id,
      method: 'bank_transfer',
      status: 'paid',
      amount: partialAmount,
      currencyCode: 'PLN',
      reference: `PARTIAL-${suffix}`,
      applications: [{ invoiceId: partialInvoice.id, amount: partialAmount }],
      userId: owner.id,
    }, { transaction: tx });

    let detail = await invoiceService.get(partialInvoice.id, ctx);
    let orderDetail = await orderService.getOrderById(partialOrder.id, ctx);
    check('Partial payment sets invoice partially_paid', detail.paymentState === 'partially_paid', detail.paymentState);
    check('Partial payment reduces invoice amountDue', money(detail.amountDue) === money(Number(partialInvoice.totalGross) - partialAmount), `amountDue=${detail.amountDue}`);
    check('Partial payment derives order paymentStatus', orderDetail.paymentStatus === 'partially_paid', orderDetail.paymentStatus);

    const remainder = money(Number(partialInvoice.totalGross) - partialAmount);
    await paymentService.create({
      companyId: company.id,
      orderId: partialOrder.id,
      method: 'bank_transfer',
      status: 'paid',
      amount: remainder,
      currencyCode: 'PLN',
      reference: `REMAINDER-${suffix}`,
      applications: [{ invoiceId: partialInvoice.id, amount: remainder }],
      userId: owner.id,
    }, { transaction: tx });
    detail = await invoiceService.get(partialInvoice.id, ctx);
    orderDetail = await orderService.getOrderById(partialOrder.id, ctx);
    check('Full payment sets invoice paid', detail.paymentState === 'paid', detail.paymentState);
    check('Full payment clears amountDue', money(detail.amountDue) === 0, `amountDue=${detail.amountDue}`);
    check('Full payment derives order paid', orderDetail.paymentStatus === 'paid', orderDetail.paymentStatus);
    check('Full payment stamps paidDate', Boolean(detail.paidDate), `paidDate=${detail.paidDate || 'null'}`);

    const { order: overpayOrder, invoice: overpayInvoice } = await createOrderAndInvoice(1);
    const overpay = await paymentService.create({
      companyId: company.id,
      orderId: overpayOrder.id,
      method: 'card',
      status: 'paid',
      amount: 200,
      currencyCode: 'PLN',
      reference: `OVERPAY-${suffix}`,
      applications: [{ invoiceId: overpayInvoice.id, amount: overpayInvoice.totalGross }],
      userId: owner.id,
    }, { transaction: tx });
    const overpaySummary = await paymentLedgerService.summarizePayment({ companyId: company.id, payment: overpay, transaction: tx });
    const overpayDetail = await invoiceService.get(overpayInvoice.id, ctx);
    check('Overpayment leaves unapplied amount', money(overpaySummary.unappliedAmount) > 0, `unapplied=${overpaySummary.unappliedAmount}`);
    check('Overpayment does not overpay invoice', money(overpayDetail.amountDue) === 0 && money(overpayDetail.amountPaid) === money(overpayInvoice.totalGross));

    const { order: multiOrderA, invoice: multiInvoiceA } = await createOrderAndInvoice(1);
    const { invoice: multiInvoiceB } = await createOrderAndInvoice(1);
    await paymentService.create({
      companyId: company.id,
      orderId: multiOrderA.id,
      method: 'bank_transfer',
      status: 'paid',
      amount: money(Number(multiInvoiceA.totalGross) + Number(multiInvoiceB.totalGross)),
      currencyCode: 'PLN',
      reference: `MULTI-INVOICE-${suffix}`,
      applications: [
        { invoiceId: multiInvoiceA.id, amount: multiInvoiceA.totalGross },
        { invoiceId: multiInvoiceB.id, amount: multiInvoiceB.totalGross },
      ],
      userId: owner.id,
    }, { transaction: tx });
    const multiA = await invoiceService.get(multiInvoiceA.id, ctx);
    const multiB = await invoiceService.get(multiInvoiceB.id, ctx);
    check('One payment can settle invoice A', multiA.paymentState === 'paid');
    check('One payment can settle invoice B', multiB.paymentState === 'paid');

    const { order: multiPaymentOrder, invoice: multiPaymentInvoice } = await createOrderAndInvoice(2);
    await paymentService.create({
      companyId: company.id,
      orderId: multiPaymentOrder.id,
      method: 'cash',
      status: 'paid',
      amount: 100,
      currencyCode: 'PLN',
      applications: [{ invoiceId: multiPaymentInvoice.id, amount: 100 }],
      userId: owner.id,
    }, { transaction: tx });
    await paymentService.create({
      companyId: company.id,
      orderId: multiPaymentOrder.id,
      method: 'cash',
      status: 'paid',
      amount: money(Number(multiPaymentInvoice.totalGross) - 100),
      currencyCode: 'PLN',
      applications: [{ invoiceId: multiPaymentInvoice.id, amount: money(Number(multiPaymentInvoice.totalGross) - 100) }],
      userId: owner.id,
    }, { transaction: tx });
    const multiPaymentDetail = await invoiceService.get(multiPaymentInvoice.id, ctx);
    check('Two payments settle one invoice', multiPaymentDetail.paymentState === 'paid' && multiPaymentDetail.payments.length === 2);

    const { invoice: creditInvoice } = await createOrderAndInvoice(2);
    const creditNote = await CreditNote.create({
      companyId: company.id,
      invoiceId: creditInvoice.id,
      orderId: creditInvoice.orderId,
      number: `LEDGER-CN-${suffix}`,
      status: 'issued',
      issuedAt: new Date(),
      amountNet: 40.65,
      amountTax: 9.35,
      amountGross: 50,
      reason: 'Ledger smoke credit',
    }, { transaction: tx });
    await paymentLedgerService.applyCreditNote({
      companyId: company.id,
      creditNoteId: creditNote.id,
      applications: [{ invoiceId: creditInvoice.id, amount: 50 }],
      userId: owner.id,
      transaction: tx,
    });
    const creditDetail = await invoiceService.get(creditInvoice.id, ctx);
    check('Credit note application reduces amountDue', money(creditDetail.amountCredited) === 50 && money(creditDetail.amountDue) === money(Number(creditInvoice.totalGross) - 50));
    check('Credit note is surfaced in invoice DTO', creditDetail.creditNotes.length === 1 && money(creditDetail.creditNotes[0].appliedAmount) === 50);

    const { order: refundOrder, invoice: refundInvoice } = await createOrderAndInvoice(1);
    const refundPayment = await paymentService.create({
      companyId: company.id,
      orderId: refundOrder.id,
      method: 'bank_transfer',
      status: 'paid',
      direction: 'refund',
      amount: refundInvoice.totalGross,
      currencyCode: 'PLN',
      reference: `REFUND-${suffix}`,
    }, { transaction: tx });
    const refundSettlement = await paymentLedgerService.deriveInvoiceSettlement({
      companyId: company.id,
      invoiceId: refundInvoice.id,
      transaction: tx,
    });
    check('Refund direction does not count as invoice paid', money(refundSettlement.amountPaid) === 0);
    await expectFailure('Refund payment cannot be applied inbound', () => paymentLedgerService.applyPayment({
      companyId: company.id,
      paymentId: refundPayment.id,
      applications: [{ invoiceId: refundInvoice.id, amount: 10 }],
      userId: owner.id,
      transaction: tx,
    }));

    const { order: invariantOrder, invoice: invariantInvoice } = await createOrderAndInvoice(1);
    const smallPayment = await paymentService.create({
      companyId: company.id,
      orderId: invariantOrder.id,
      method: 'cash',
      status: 'paid',
      amount: 10,
      currencyCode: 'PLN',
    }, { transaction: tx });
    await expectFailure('Over-apply payment fails', () => paymentLedgerService.applyPayment({
      companyId: company.id,
      paymentId: smallPayment.id,
      applications: [{ invoiceId: invariantInvoice.id, amount: 11 }],
      userId: owner.id,
      transaction: tx,
    }));

    const largePayment = await paymentService.create({
      companyId: company.id,
      orderId: invariantOrder.id,
      method: 'cash',
      status: 'paid',
      amount: 1000,
      currencyCode: 'PLN',
    }, { transaction: tx });
    await expectFailure('Over-settle invoice fails', () => paymentLedgerService.applyPayment({
      companyId: company.id,
      paymentId: largePayment.id,
      applications: [{ invoiceId: invariantInvoice.id, amount: money(Number(invariantInvoice.totalGross) + 1) }],
      userId: owner.id,
      transaction: tx,
    }));

    const noApplicationPayment = await paymentService.create({
      companyId: company.id,
      orderId: invariantOrder.id,
      method: 'bank_transfer',
      status: 'paid',
      amount: 25,
      currencyCode: 'PLN',
      reference: `ON-ACCOUNT-${suffix}`,
    }, { transaction: tx });
    const noApplicationSummary = await paymentLedgerService.summarizePayment({
      companyId: company.id,
      payment: noApplicationPayment,
      transaction: tx,
    });
    const noApplicationOrder = await orderService.getOrderById(invariantOrder.id, ctx);
    check('Paid payment without applications remains unapplied', money(noApplicationSummary.unappliedAmount) === 25);
    check('Paid payment without applications does not mark order paid', noApplicationOrder.paymentStatus !== 'paid', noApplicationOrder.paymentStatus);

    await tx.rollback();
    tx = null;
    check('Disposable ledger data rolled back', true);

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      process.exitCode = 1;
      // eslint-disable-next-line no-console
      console.error(`OMS payment ledger smoke failed: ${failed.length} failing check(s)`);
    } else {
      // eslint-disable-next-line no-console
      console.log('OMS payment ledger smoke passed');
    }
  } catch (error) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('OMS payment ledger smoke failed:', error);
    if (tx && !tx.finished) {
      await tx.rollback().catch((rollbackError) => {
        // eslint-disable-next-line no-console
        console.error('OMS payment ledger rollback failed:', rollbackError);
      });
    }
  } finally {
    await sequelize.close();
  }
})();
