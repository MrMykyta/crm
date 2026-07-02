'use strict';

const crypto = require('crypto');
const {
  sequelize,
  Company,
  Counterparty,
  Offer,
  InvoiceItem,
  OrderItem,
  Product,
  TaxCategory,
  User,
  UserCompany,
} = require('../src/models');
const offerService = require('../src/services/oms/offerService');
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

function closeMoney(value, expected) {
  return Math.abs(money(value) - money(expected)) < 0.01;
}

(async () => {
  let tx;
  try {
    await sequelize.authenticate();
    tx = await sequelize.transaction();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await User.create({
      id: crypto.randomUUID(),
      email: `oms-tax-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: tx });

    const company = await Company.create({
      id: crypto.randomUUID(),
      name: `OMS Tax Smoke ${suffix}`,
      ownerUserId: owner.id,
    }, { transaction: tx });

    await UserCompany.create({
      id: crypto.randomUUID(),
      userId: owner.id,
      companyId: company.id,
      role: 'owner',
      status: 'active',
    }, { transaction: tx });

    const customer = await Counterparty.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      shortName: `Tax Customer ${suffix}`.slice(0, 120),
      fullName: `Tax Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
    }, { transaction: tx });

    const tax23 = await TaxCategory.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      code: `VAT23-${suffix}`.slice(0, 32),
      name: 'VAT 23',
      rate: 23,
    }, { transaction: tx });

    const product = await Product.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      name: `Tax Product ${suffix}`,
      slug: `tax-product-${suffix}`,
      sku: `TAX-${suffix}`.slice(0, 64),
      status: 'active',
      currency: 'PLN',
      price: 100,
      trackInventory: false,
      taxCategoryId: tax23.id,
    }, { transaction: tx });

    const userContext = {
      id: owner.id,
      userId: owner.id,
      companyId: company.id,
      transaction: tx,
    };

    const offer = await offerService.createOffer({
      number: `TAX-OFFER-${suffix}`,
      counterpartyId: customer.id,
      ownerId: owner.id,
      currency: 'PLN',
      issueDate: new Date().toISOString().slice(0, 10),
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPriceNet: 100,
          taxRate: 23,
        },
      ],
    }, userContext, { transaction: tx });

    check('Offer VAT 23 gross is 123', closeMoney(offer.totalGross, 123), `gross=${offer.totalGross}`);
    check('Offer VAT amount is 23', closeMoney(offer.totalVat, 23), `tax=${offer.totalVat}`);
    check('Offer DTO preserves taxRate 23', closeMoney(offer.items?.[0]?.taxRate, 23), `taxRate=${offer.items?.[0]?.taxRate}`);
    check('Offer DTO preserves vatRateSnapshot 23', closeMoney(offer.items?.[0]?.vatRateSnapshot, 23), `snapshot=${offer.items?.[0]?.vatRateSnapshot}`);

    const zeroVatOffer = await offerService.createOffer({
      number: `TAX-OFFER-ZERO-${suffix}`,
      counterpartyId: customer.id,
      ownerId: owner.id,
      currency: 'PLN',
      issueDate: new Date().toISOString().slice(0, 10),
      items: [
        {
          nameSnapshot: 'Zero VAT custom line',
          quantity: 1,
          unitPriceNet: 100,
          taxRate: 0,
        },
      ],
    }, userContext, { transaction: tx });

    check('VAT 0 is preserved as 0', closeMoney(zeroVatOffer.items?.[0]?.taxRate, 0), `taxRate=${zeroVatOffer.items?.[0]?.taxRate}`);
    check('VAT 0 gross remains net', closeMoney(zeroVatOffer.totalGross, 100), `gross=${zeroVatOffer.totalGross}`);

    await Offer.update(
      {
        status: 'accepted',
        sentAt: new Date(),
        acceptedAt: new Date(),
        lastStatusChangedAt: new Date(),
      },
      { where: { id: offer.id, companyId: company.id }, transaction: tx }
    );
    const conversion = await offerService.convertOfferToOrder(offer.id, {
      number: `TAX-ORDER-${suffix}`,
    }, userContext, { transaction: tx });

    const order = conversion.order;
    const orderDetail = await orderService.getOrderById(order.id, userContext);
    const orderItem = await OrderItem.findOne({
      where: { companyId: company.id, orderId: order.id },
      transaction: tx,
    });
    check('Offer→Order preserves gross 123', closeMoney(order.totalGross, 123), `gross=${order.totalGross}`);
    check('Offer→Order preserves VAT 23 in DTO', closeMoney(orderDetail.items?.[0]?.taxRate, 23), `taxRate=${orderDetail.items?.[0]?.taxRate}`);
    check('Offer→Order persists VAT 23', closeMoney(orderItem?.taxRate, 23), `taxRate=${orderItem?.taxRate}`);

    const invoice = await invoiceService.issue(order.id, {
      number: `TAX-INVOICE-${suffix}`,
      issueDate: new Date(),
    }, userContext);
    const invoiceDetail = await invoiceService.get(invoice.id, userContext);
    const invoiceItem = await InvoiceItem.findOne({
      where: { companyId: company.id, invoiceId: invoice.id },
      transaction: tx,
    });

    check('Order→Invoice preserves gross 123', closeMoney(invoiceDetail.totalGross, 123), `gross=${invoiceDetail.totalGross}`);
    check('Order→Invoice preserves VAT 23 in DTO', closeMoney(invoiceDetail.items?.[0]?.taxRate, 23), `taxRate=${invoiceDetail.items?.[0]?.taxRate}`);
    check('Order→Invoice persists VAT 23', closeMoney(invoiceItem?.taxRate, 23), `taxRate=${invoiceItem?.taxRate}`);

    await tx.rollback();
    tx = null;
    check('Disposable QA data rolled back', true);

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      process.exitCode = 1;
      // eslint-disable-next-line no-console
      console.error(`OMS tax totals smoke failed: ${failed.length} failing check(s)`);
    } else {
      // eslint-disable-next-line no-console
      console.log('OMS tax totals smoke passed');
    }
  } catch (error) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('OMS tax totals smoke failed:', error);
    if (tx) {
      await tx.rollback().catch((rollbackError) => {
        // eslint-disable-next-line no-console
        console.error('OMS tax totals rollback failed:', rollbackError);
      });
    }
  } finally {
    await sequelize.close();
  }
})();
