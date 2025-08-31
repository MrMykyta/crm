const { Invoice, Order } = require('../../models');

module.exports.issue = async (orderId, payload={}) => {
    const t = await Invoice.sequelize.transaction();
    try {
        const order = await Order.findByPk(orderId, { transaction:t });
        if (!order) throw new Error('Order not found');

        const inv = await Invoice.create({
        orderId: order.id,
        companyId: order.companyId,
        number: payload.number || `INV-${Date.now()}`,
        totalNet: order.totalNet,
        totalTax: order.totalTax,
        totalGross: order.totalGross,
        ...payload
        }, { transaction:t });

        await t.commit();
        return inv;
    } catch (e) { 
        await t.rollback(); 
        throw e; 
    }
};

module.exports.list = async (q={}) => Invoice.findAll({ where:q, order:[['createdAt','DESC']] });

module.exports.get  = async (id) => Invoice.findByPk(id);

module.exports.cancel = async (id, payload={}) => {
    const inv = await Invoice.findByPk(id);
    if (!inv) {
        throw new Error('Invoice not found');
    }
    // мягкая отмена без редактирования финансовых сумм
    return inv.update({ status: 'cancelled', cancelledAt: new Date(), ...payload });
};