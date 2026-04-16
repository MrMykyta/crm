const { Payment, Order } = require('../../models');

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async (q={}) => {
  return Payment.findAll({ where:q, order:[['createdAt','DESC']] });
};

// create: создаёт новую запись и возвращает результат.
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
