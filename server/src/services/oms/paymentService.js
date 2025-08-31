const { Payment, Order } = require('../../models');

module.exports.list = async (q={}) => {
  return Payment.findAll({ where:q, order:[['createdAt','DESC']] });
};

module.exports.create = async (payload) => {
  const t = await Payment.sequelize.transaction();
  try {
    const p = await Payment.create(payload, { transaction:t });
    if (p.status === 'paid') {
      await Order.update({ paymentStatus:'paid' }, { where:{ id:p.orderId }, transaction:t });
    }
    await t.commit();
    return p;
  } catch (e) { await t.rollback(); throw e; }
};