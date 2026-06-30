'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Counterparty,
  Offer,
  OfferItem,
  Order,
  OrderItem,
  Product,
  TaxCategory,
  User,
  UserCompany,
} = require('../src/models');
const offerService = require('../src/services/oms/offerService');

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

function userCtx(user, companyId) {
  return { id: user.id, companyId };
}

async function createQaContext(suffix) {
  const owner = await User.create({
    id: uuidv4(),
    email: `oms-offer-lifecycle-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });

  const company = await Company.create({
    id: uuidv4(),
    name: `OMS Offer Lifecycle ${suffix}`,
    ownerUserId: owner.id,
  });

  await UserCompany.create({
    id: uuidv4(),
    userId: owner.id,
    companyId: company.id,
    role: 'owner',
    status: 'active',
  });

  return { owner, company };
}

async function cleanupQaData({ companyId, ownerId }) {
  if (companyId) {
    const offers = await Offer.findAll({
      where: { companyId },
      attributes: ['id'],
      paranoid: false,
    });
    const offerIds = offers.map((row) => row.id);

    const orders = await Order.findAll({
      where: { companyId },
      attributes: ['id'],
      paranoid: false,
    });
    const orderIds = orders.map((row) => row.id);

    if (orderIds.length) {
      await OrderItem.destroy({ where: { orderId: orderIds }, force: true });
      await Order.destroy({ where: { id: orderIds }, force: true });
    }

    if (offerIds.length) {
      await OfferItem.destroy({ where: { offerId: offerIds }, force: true });
      await Offer.destroy({ where: { id: offerIds }, force: true });
    }

    await Product.destroy({ where: { companyId }, force: true });
    await TaxCategory.destroy({ where: { companyId }, force: true });
    await Counterparty.destroy({ where: { companyId }, force: true });
    await UserCompany.destroy({ where: { companyId }, force: true });
    await Company.destroy({ where: { id: companyId }, force: true });
  }

  if (ownerId) {
    await UserCompany.destroy({ where: { userId: ownerId }, force: true });
    await User.destroy({ where: { id: ownerId }, force: true });
  }
}

(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = {
    companyId: null,
    ownerId: null,
  };

  try {
    await sequelize.authenticate();

    const { owner, company } = await createQaContext(suffix);
    created.companyId = company.id;
    created.ownerId = owner.id;
    const ctx = userCtx(owner, company.id);

    const counterparty = await Counterparty.create({
      id: uuidv4(),
      companyId: company.id,
      shortName: `OMS QA Customer ${suffix}`.slice(0, 120),
      fullName: `OMS QA Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
    });

    const taxCategory = await TaxCategory.create({
      id: uuidv4(),
      companyId: company.id,
      code: `VAT23-${suffix}`.slice(0, 32),
      name: 'Smoke VAT 23',
      rate: 23,
    });

    const product = await Product.create({
      id: uuidv4(),
      companyId: company.id,
      name: `OMS QA Product ${suffix}`,
      slug: `oms-qa-product-${suffix}`,
      sku: `OMS-QA-${suffix}`.slice(0, 64),
      status: 'active',
      currency: 'PLN',
      price: 100,
      trackInventory: false,
      taxCategoryId: taxCategory.id,
    });

    const offer = await offerService.createOffer({
      number: `SMOKE-OFFER-${suffix}`,
      counterpartyId: counterparty.id,
      ownerId: owner.id,
      currency: 'PLN',
      exchangeRate: 1,
      issueDate: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      title: 'Disposable lifecycle smoke offer',
      subject: 'Happy-path offer actions QA',
      paymentTerms: '14 days',
      deliveryTerms: 'Standard',
      items: [
        {
          productId: product.id,
          quantity: 2,
          unitPriceNet: 100,
          discountType: 'percent',
          discountValue: 10,
        },
        {
          lineType: 'custom',
          nameSnapshot: 'Custom onboarding',
          quantity: 1,
          unitPriceNet: 50,
          vatRateSnapshot: 23,
          discountType: 'none',
          discountValue: 0,
        },
      ],
    }, ctx);

    check('Offer created in draft', offer.status === 'draft', `status=${offer.status}`);
    check('Offer has two line items', Array.isArray(offer.items) && offer.items.length === 2, `items=${offer.items?.length}`);
    check('Offer totals net', closeMoney(offer.subtotalNet, 230), `subtotalNet=${offer.subtotalNet}`);
    check('Offer totals tax', closeMoney(offer.totalVat, 52.9), `totalVat=${offer.totalVat}`);
    check('Offer totals gross', closeMoney(offer.totalGross, 282.9), `totalGross=${offer.totalGross}`);
    check('Draft can send and delete', offer.availableActions?.canSend && offer.availableActions?.canDelete);

    const sent = await offerService.changeOfferStatus(offer.id, 'sent', {}, ctx);
    check('Offer sent', sent.status === 'sent', `status=${sent.status}`);
    check('Sent offer has sentAt', Boolean(sent.statusMetadata?.sentAt), `sentAt=${sent.statusMetadata?.sentAt || 'null'}`);
    check('Sent offer can accept/reject', sent.availableActions?.canAccept && sent.availableActions?.canReject);

    const accepted = await offerService.changeOfferStatus(offer.id, 'accepted', {}, ctx);
    check('Offer accepted', accepted.status === 'accepted', `status=${accepted.status}`);
    check('Accepted offer has acceptedAt', Boolean(accepted.statusMetadata?.acceptedAt), `acceptedAt=${accepted.statusMetadata?.acceptedAt || 'null'}`);
    check('Accepted offer can convert to order', accepted.availableActions?.canConvertToOrder === true);
    check('Accepted offer is readonly', accepted.availableActions?.canEdit === false);

    const conversion = await offerService.convertOfferToOrder(offer.id, {
      number: `SMOKE-ORDER-${suffix}`,
    }, ctx);
    check('Offer converted to order', Boolean(conversion?.order?.id), `order=${conversion?.order?.id || 'null'}`);
    check('Converted offer links order', conversion?.offer?.convertedOrderId === conversion?.order?.id);
    check('Converted offer cannot convert again', conversion?.offer?.availableActions?.canConvertToOrder === false);

    const orderItems = await OrderItem.findAll({
      where: { orderId: conversion.order.id, companyId: company.id },
      order: [['sortOrder', 'ASC']],
    });
    check('Order received copied items', orderItems.length === 2, `items=${orderItems.length}`);
    check('Order totals match offer', closeMoney(conversion.order.totalGross, 282.9), `totalGross=${conversion.order.totalGross}`);

    const duplicate = await offerService.duplicateOffer(offer.id, {
      number: `SMOKE-OFFER-DUP-${suffix}`,
      title: 'Duplicated lifecycle smoke offer',
    }, ctx);
    check('Duplicate is draft', duplicate.status === 'draft', `status=${duplicate.status}`);
    check('Duplicate copies items', Array.isArray(duplicate.items) && duplicate.items.length === 2, `items=${duplicate.items?.length}`);
    check('Duplicate can delete', duplicate.availableActions?.canDelete === true);

    await offerService.deleteOffer(duplicate.id, ctx);
    const deletedDuplicate = await Offer.findByPk(duplicate.id, { paranoid: false });
    check('Duplicate deleted through service', Boolean(deletedDuplicate?.deletedAt), `deletedAt=${deletedDuplicate?.deletedAt || 'null'}`);

    await cleanupQaData(created);
    created.companyId = null;
    created.ownerId = null;
    check('Disposable QA data cleaned', true);

    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      process.exitCode = 1;
      // eslint-disable-next-line no-console
      console.error(`OMS offer lifecycle smoke failed: ${failed.length} failing check(s)`);
    } else {
      // eslint-disable-next-line no-console
      console.log('OMS offer lifecycle smoke passed');
    }
  } catch (error) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('OMS offer lifecycle smoke failed:', error);
    await cleanupQaData(created).catch((cleanupError) => {
      // eslint-disable-next-line no-console
      console.error('OMS offer lifecycle cleanup failed:', cleanupError);
    });
  } finally {
    await sequelize.close();
  }
})();
