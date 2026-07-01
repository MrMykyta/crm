const { Payment } = require('../../models');
const paymentLedgerService = require('./paymentLedgerService');

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async (q={}) => {
  return Payment.findAll({ where:q, order:[['createdAt','DESC']] });
};

// create: создаёт новую запись и возвращает результат.
module.exports.create = async (payload, options = {}) => {
  const externalTx = options.transaction || null;
  const t = externalTx || await Payment.sequelize.transaction();
  const ownTransaction = !externalTx;
  try {
    const applications = Array.isArray(payload.applications)
      ? payload.applications
      : Array.isArray(payload.invoiceApplications)
        ? payload.invoiceApplications
        : [];
    const {
      applications: _applications,
      invoiceApplications: _invoiceApplications,
      companyId,
      orderId,
      ...rest
    } = payload;
    const p = await Payment.create({
      ...rest,
      companyId,
      orderId,
      direction: payload.direction || 'inbound',
      currencyCode: payload.currencyCode || payload.currency || null,
    }, { transaction:t });

    if (applications.length) {
      await paymentLedgerService.applyPayment({
        companyId: p.companyId,
        paymentId: p.id,
        applications,
        userId: payload.userId || payload.createdBy || null,
        transaction: t,
      });
    }
    if (ownTransaction) {
      await t.commit();
    }
    return p;
  } catch (e) {
    if (ownTransaction) {
      await t.rollback();
    }
    throw e;
  }
};
