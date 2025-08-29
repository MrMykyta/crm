
// priceListItemService.js (generated)
const { Op } = require('sequelize');
const { PriceListItem } = require('../../models');

const parse = (q={})=>{ const page=Math.max(parseInt(q.page||'1',10),1); const limit=Math.min(Math.max(parseInt(q.limit||'20',10),1),200); return { page, limit, offset:(page-1)*limit }; };

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parse(query);
  const where = {};
  if (query.companyId) where.companyId = query.companyId; else if (user?.companyId) where.companyId = user.companyId;
  if (query.priceListId) where.priceListId = query.priceListId;
  if (query.productId) where.productId = query.productId;
  if (query.variantId) where.variantId = query.variantId;
  if (query.minQty) where.minQty = query.minQty;
  // no free-text search
  const { rows, count } = await PriceListItem.findAndCountAll({ where,  order:[['createdAt','DESC']], limit, offset });
  return { rows, count, page, limit };
};

module.exports.getById = (id) => id ? PriceListItem.findByPk(id, {  }) : null;
module.exports.create  = (payload={}) => { if(!payload.companyId) throw new Error('companyId is required'); return PriceListItem.create(payload); };
module.exports.update  = async (id, payload={}) => { const it=await PriceListItem.findByPk(id); if(!it) return null; await it.update(payload); return module.exports.getById(id); };
module.exports.remove  = (id) => PriceListItem.destroy({ where:{ id } });
