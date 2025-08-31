const { Sequelize, Order, OrderItem, Offer, OfferItem, Discount, Invoice, Payment, ProductVariant, Uom } = require('../../models');

const parsePaging = (q={}) => { const page=Math.max(parseInt(q.page||'1',10),1); const limit=Math.min(Math.max(parseInt(q.limit||'20',10),1),200); return { page,limit,offset:(page-1)*limit }; };
const buildOrder = (q={}) => String(q.sort||'created_at:desc').split(',').filter(Boolean).map(s=>{const[f,d]=s.split(':');return [f,(d||'asc').toUpperCase()]});
const buildWhere = (q={}, user={}) => {
  const w={};
  if (q.companyId) w.companyId=q.companyId;
  else if (user?.companyId) w.companyId=user.companyId;
  if (q.customerId) w.customerId=q.customerId;
  if (q.status) w.status=q.status;
  if (q.paymentStatus) w.paymentStatus=q.paymentStatus;
  return w;
};
const calcTotals = (items=[]) => {
  let net=0,gross=0,tax=0;
  for (const it of items) { const q=Number(it.qty||0); const pn=Number(it.priceNet||0)*q; const pg=Number(it.priceGross||0)*q; const tr=Number(it.taxRate||0); net+=pn; gross+=pg; tax+= +(pg-pn).toFixed(2) || +(pn*tr/100).toFixed(2); }
  return { totalNet:+net.toFixed(2), totalGross:+gross.toFixed(2), totalTax:+tax.toFixed(2) };
};

module.exports.list = async (query={}, user={}) => {
  const { page, limit, offset } = parsePaging(query);
  const rows = await Order.findAndCountAll({
    where: buildWhere(query,user), limit, offset, order: buildOrder(query),
    include: [{ model: OrderItem, as:'items', required:false }]
  });
  return { page, limit, total: rows.count, rows: rows.rows };
};

module.exports.get = async (id) => {
  return Order.findByPk(id, {
    include: [
      { model: OrderItem, as:'items', include:[
        { model: ProductVariant, as:'variant' },
        { model: Uom, as:'uom' },
      ]},
      { model: Discount, as:'discounts' },
      { model: Invoice, as:'invoices' },
      { model: Payment, as:'payments' },
    ]
  });
};

module.exports.create = async (payload, user) => {
  const t = await Order.sequelize.transaction();
  try {
    const { items=[], ...head } = payload;
    const totals = calcTotals(items);
    const order = await Order.create({
      ...head,
      companyId: head.companyId || user.companyId,
      status: head.status || 'new',
      paymentStatus: head.paymentStatus || 'pending',
      fulfillmentStatus: head.fulfillmentStatus || 'unfulfilled',
      ...totals
    }, { transaction:t });

    for (const it of items) {
      await OrderItem.create({ ...it, orderId: order.id, companyId: order.companyId }, { transaction:t });
    }
    await t.commit();
    return module.exports.get(order.id);
  } catch (e) { await t.rollback(); throw e; }
};

module.exports.fromOffer = async (offerId, head={}) => {
  const t = await Order.sequelize.transaction();
  try {
    const offer = await Offer.findByPk(offerId, { include:[{ model: OfferItem, as:'items' }], transaction:t });
    if (!offer) throw new Error('Offer not found');

    const order = await Order.create({
      companyId: offer.companyId,
      offerId: offer.id,
      customerId: offer.customerId,
      currencyCode: offer.currencyCode,
      status: 'new',
      paymentStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      totalNet: offer.totalNet,
      totalTax: offer.totalTax,
      totalGross: offer.totalGross,
      ...head
    }, { transaction:t });

    for (const it of offer.items) {
      await OrderItem.create({
        companyId: offer.companyId,
        orderId: order.id,
        variantId: it.variantId,
        uomId: it.uomId,
        sku: it.sku,
        nameSnapshot: it.nameSnapshot,
        qty: it.qty,
        priceNet: it.priceNet,
        priceGross: it.priceGross,
        taxRate: it.taxRate,
        discountAmount: it.discountAmount
      }, { transaction:t });
    }
    await t.commit();
    return module.exports.get(order.id);
  } catch (e) { await t.rollback(); throw e; }
};

module.exports.update = async (id, payload) => {
  const t = await Order.sequelize.transaction();
  try {
    const order = await Order.findByPk(id, { transaction:t });
    if (!order) throw new Error('Order not found');

    const { items, recalcTotals, ...head } = payload;
    if (head && Object.keys(head).length) await order.update(head, { transaction:t });

    if (Array.isArray(items)) {
      await OrderItem.destroy({ where:{ orderId:id }, transaction:t });
      for (const it of items) await OrderItem.create({ ...it, orderId:id, companyId:order.companyId }, { transaction:t });
      const totals = calcTotals(items);
      await order.update(totals, { transaction:t });
    } else if (recalcTotals) {
      const fresh = await OrderItem.findAll({ where:{ orderId:id }, transaction:t });
      const totals = calcTotals(fresh);
      await order.update(totals, { transaction:t });
    }
    await t.commit();
    return module.exports.get(id);
  } catch (e) { await t.rollback(); throw e; }
};

module.exports.remove = async (id) => {
  await Order.destroy({ where:{ id } });
  return { success:true };
};