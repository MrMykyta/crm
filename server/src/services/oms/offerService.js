const { Sequelize, Offer, OfferItem, Discount, ProductVariant, Uom } = require('../../models');

const parsePaging = (q={}) => {
  const page = Math.max(parseInt(q.page||'1',10),1);
  const limit = Math.min(Math.max(parseInt(q.limit||'20',10),1),200);
  return { page, limit, offset:(page-1)*limit };
};
const buildOrder = (q={}) =>
  String(q.sort||'created_at:desc').split(',').filter(Boolean).map(s=>{
    const[a,b]=s.split(':');
    return [a,(b||'asc').toUpperCase()];
  });
const buildWhere = (q={}, user={}) => {
  const w = {};
  if (q.companyId) w.companyId = q.companyId;
  else if (user?.companyId) w.companyId = user.companyId;
  if (q.customerId) w.customerId = q.customerId;
  if (q.status) w.status = q.status;
  if (q.search) w[Sequelize.Op.or] = [
    { currencyCode:{ [Sequelize.Op.iLike]: `%${q.search}%` } }
  ];
  return w;
};
const calcTotals = (items=[]) => {
  let net=0,gross=0,tax=0;
  for (const it of items) {
    const q = Number(it.qty||0);
    const pn = Number(it.priceNet||0)*q;
    const pg = Number(it.priceGross||0)*q;
    const tr = Number(it.taxRate||0);
    net+=pn; gross+=pg; tax+= +(pg-pn).toFixed(2) || +(pn*tr/100).toFixed(2);
  }
  return { totalNet:+net.toFixed(2), totalGross:+gross.toFixed(2), totalTax:+tax.toFixed(2) };
};

module.exports.list = async (query={}, user={}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const rows = await Offer.findAndCountAll({
    where, limit, offset, order: buildOrder(query),
    include: [{ model: OfferItem, as:'items', required:false }]
  });
  return { page, limit, total: rows.count, rows: rows.rows };
};

module.exports.get = async (id) => {
  return Offer.findByPk(id, {
    include: [
      { model: OfferItem, as:'items', include: [
        { model: ProductVariant, as:'variant' },
        { model: Uom, as:'uom' },
      ]},
      { model: Discount, as:'discounts' },
    ]
  });
};

module.exports.create = async (payload, user) => {
  const t = await Offer.sequelize.transaction();
  try {
    const { items=[], ...head } = payload;
    const totals = calcTotals(items);
    const offer = await Offer.create({
      ...head,
      companyId: head.companyId || user.companyId,
      ...totals
    }, { transaction: t });

    for (const it of items) {
      await OfferItem.create({ ...it, offerId: offer.id }, { transaction: t });
    }
    await t.commit();
    return module.exports.get(offer.id);
  } catch (e) { await t.rollback(); throw e; }
};

module.exports.update = async (id, payload) => {
  const t = await Offer.sequelize.transaction();
  try {
    const offer = await Offer.findByPk(id, { transaction:t });
    if (!offer) throw new Error('Offer not found');

    const { items, ...head } = payload;
    if (head && Object.keys(head).length) await offer.update(head, { transaction:t });

    if (Array.isArray(items)) {
      await OfferItem.destroy({ where:{ offerId:id }, transaction:t });
      for (const it of items) await OfferItem.create({ ...it, offerId:id }, { transaction:t });
      const totals = calcTotals(items);
      await offer.update(totals, { transaction:t });
    }
    await t.commit();
    return module.exports.get(id);
  } catch (e) { await t.rollback(); throw e; }
};

module.exports.remove = async (id) => {
  await Offer.destroy({ where:{ id } });
  return { success:true };
};