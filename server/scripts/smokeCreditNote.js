'use strict';

const crypto = require('crypto');
const {
  sequelize,
  Company,
  User,
  UserCompany,
  Counterparty,
  Product,
} = require('../src/models');
const orderService = require('../src/services/oms/orderService');
const invoiceService = require('../src/services/oms/invoiceService');
const paymentService = require('../src/services/oms/paymentService');
const creditNoteService = require('../src/services/oms/creditNoteService');

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

async function expectFailure(name, fn, expectedCode = null) {
  try {
    await fn();
    check(name, false, 'expected failure but succeeded');
  } catch (error) {
    const code = error?.code || error?.details?.code || null;
    check(name, !expectedCode || code === expectedCode, code || error?.message || 'failed as expected');
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
      email: `oms-credit-note-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: tx });

    const company = await Company.create({
      id: crypto.randomUUID(),
      name: `OMS Credit Note Smoke ${suffix}`,
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
      shortName: `Credit Note Customer ${suffix}`.slice(0, 120),
      fullName: `Credit Note Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
    }, { transaction: tx });

    const product = await Product.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      name: `Credit Note Product ${suffix}`,
      slug: `credit-note-product-${suffix}`,
      sku: `CN-${suffix}`.slice(0, 64),
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
        number: `CN-ORD-${orderSeq}-${suffix}`,
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
        number: `CN-INV-${orderSeq}-${suffix}`,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
      }, { transaction: tx });

      return { order, invoice };
    }

    const { invoice: applyInvoice } = await createOrderAndInvoice(5);
    const creditNote = await creditNoteService.issue({
      companyId: company.id,
      invoiceId: applyInvoice.id,
      payload: {
        number: `CN-APPLY-${suffix}`,
        amountNet: 500,
        amountTax: 0,
        amountGross: 500,
        reason: 'Smoke partial credit',
      },
      userId: owner.id,
      transaction: tx,
    });
    check('Issue creates credit note detail DTO', creditNote.id && creditNote.status === 'issued', creditNote.status);
    check('Issue exposes remaining credit', money(creditNote.remainingCredit) === 500, `remaining=${creditNote.remainingCredit}`);

    let applied = await creditNoteService.apply({
      companyId: company.id,
      creditNoteId: creditNote.id,
      applications: [{ invoiceId: applyInvoice.id, amount: 200 }],
      userId: owner.id,
      transaction: tx,
    });
    let invoiceDetail = await invoiceService.get(applyInvoice.id, ctx);
    check('Partial credit application reduces invoice due', money(invoiceDetail.amountCredited) === 200, `credited=${invoiceDetail.amountCredited}`);
    check('Partial credit application keeps remaining credit', money(applied.creditNote.remainingCredit) === 300, `remaining=${applied.creditNote.remainingCredit}`);

    applied = await creditNoteService.apply({
      companyId: company.id,
      creditNoteId: creditNote.id,
      applications: [{ invoiceId: applyInvoice.id, amount: 300 }],
      userId: owner.id,
      transaction: tx,
    });
    invoiceDetail = await invoiceService.get(applyInvoice.id, ctx);
    check('Remainder credit application updates invoice amountCredited', money(invoiceDetail.amountCredited) === 500, `credited=${invoiceDetail.amountCredited}`);
    check('Remainder credit application exhausts credit note', money(applied.creditNote.remainingCredit) === 0, `remaining=${applied.creditNote.remainingCredit}`);

    await expectFailure('Credit note cannot be over-applied', async () => {
      const { invoice } = await createOrderAndInvoice(1);
      const cn = await creditNoteService.issue({
        companyId: company.id,
        invoiceId: invoice.id,
        payload: { amountGross: 100, amountNet: 100, amountTax: 0 },
        userId: owner.id,
        transaction: tx,
      });
      await creditNoteService.apply({
        companyId: company.id,
        creditNoteId: cn.id,
        applications: [{ invoiceId: invoice.id, amount: 120 }],
        userId: owner.id,
        transaction: tx,
      });
    }, 'CREDIT_NOTE_OVER_APPLIED');

    await expectFailure('Credit note cannot over-settle invoice', async () => {
      const { order, invoice } = await createOrderAndInvoice(1);
      await paymentService.create({
        companyId: company.id,
        orderId: order.id,
        method: 'bank_transfer',
        status: 'paid',
        amount: 110,
        currencyCode: 'PLN',
        reference: `CN-PAY-${suffix}`,
        applications: [{ invoiceId: invoice.id, amount: 110 }],
        userId: owner.id,
      }, { transaction: tx });
      const cn = await creditNoteService.issue({
        companyId: company.id,
        invoiceId: invoice.id,
        payload: { amountGross: 100, amountNet: 100, amountTax: 0 },
        userId: owner.id,
        transaction: tx,
      });
      await creditNoteService.apply({
        companyId: company.id,
        creditNoteId: cn.id,
        applications: [{ invoiceId: invoice.id, amount: 20 }],
        userId: owner.id,
        transaction: tx,
      });
    }, 'INVOICE_OVER_SETTLED');

    const { invoice: cancelInvoice } = await createOrderAndInvoice(1);
    const cancellable = await creditNoteService.issue({
      companyId: company.id,
      invoiceId: cancelInvoice.id,
      payload: { amountGross: 50, amountNet: 50, amountTax: 0 },
      userId: owner.id,
      transaction: tx,
    });
    const cancelled = await creditNoteService.cancel({
      companyId: company.id,
      id: cancellable.id,
      userId: owner.id,
      transaction: tx,
    });
    check('Unused credit note can be cancelled', cancelled.status === 'cancelled', cancelled.status);

    const { order: refundOrder, invoice: refundInvoice } = await createOrderAndInvoice(1);
    await paymentService.create({
      companyId: company.id,
      orderId: refundOrder.id,
      method: 'bank_transfer',
      status: 'paid',
      amount: refundInvoice.totalGross,
      currencyCode: 'PLN',
      reference: `CN-PAID-${suffix}`,
      applications: [{ invoiceId: refundInvoice.id, amount: refundInvoice.totalGross }],
      userId: owner.id,
    }, { transaction: tx });
    const refundCredit = await creditNoteService.issue({
      companyId: company.id,
      invoiceId: refundInvoice.id,
      payload: { amountGross: 50, amountNet: 50, amountTax: 0, reason: 'Refund customer' },
      userId: owner.id,
      transaction: tx,
    });
    await expectFailure('Applied credit on fully paid invoice is blocked', async () => {
      await creditNoteService.apply({
        companyId: company.id,
        creditNoteId: refundCredit.id,
        applications: [{ invoiceId: refundInvoice.id, amount: 1 }],
        userId: owner.id,
        transaction: tx,
      });
    }, 'INVOICE_OVER_SETTLED');

    const refundResult = await creditNoteService.refund({
      companyId: company.id,
      id: refundCredit.id,
      amount: 50,
      method: 'bank_transfer',
      reference: `SMOKE-${suffix}`,
      userId: owner.id,
      transaction: tx,
    });
    const refundedInvoice = await invoiceService.get(refundInvoice.id, ctx);
    check('Refund creates outbound payment summary', refundResult.refundPayment?.direction === 'refund', refundResult.refundPayment?.direction);
    check('Refund does not change invoice settlement applications', money(refundedInvoice.amountDue) === 0 && money(refundedInvoice.amountPaid) === money(refundInvoice.totalGross));

    const list = await creditNoteService.list({
      companyId: company.id,
      filters: { invoiceId: applyInvoice.id },
      transaction: tx,
    });
    const detail = await creditNoteService.getById({
      companyId: company.id,
      id: creditNote.id,
      transaction: tx,
    });
    check('List returns credit notes', list.length === 1 && list[0].id === creditNote.id, `count=${list.length}`);
    check('Get returns applications and events', detail.applications.length === 2 && detail.events.length >= 3, `apps=${detail.applications.length}`);

    await tx.rollback();
    tx = null;

    const failed = results.filter((item) => !item.ok);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error(`Credit note smoke failed: ${failed.map((item) => item.name).join(', ')}`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(`Credit note smoke passed (${results.length} checks).`);
    process.exit(0);
  } catch (error) {
    if (tx) {
      try {
        await tx.rollback();
      } catch (_) {
        // ignore rollback failure in smoke cleanup
      }
    }
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  }
})();
