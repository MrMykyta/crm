
// channelListingService.js (generated)
const { Op } = require('sequelize');
const { ChannelListing } = require('../../models');

const parse = (q={})=>{ const page=Math.max(parseInt(q.page||'1',10),1); const limit=Math.min(Math.max(parseInt(q.limit||'20',10),1),200); return { page, limit, offset:(page-1)*limit }; };

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parse(query);
  const where = {};
  if (query.companyId) where.companyId = query.companyId; else if (user?.companyId) where.companyId = user.companyId;
  if (query.channelId) where.channelId = query.channelId;
  if (query.productId) where.productId = query.productId;
  if (query.variantId) where.variantId = query.variantId;
  if (query.q) { where[Op.or] = [{ channelSku: { [Op.iLike]: `%${query.q}%` } }]; }
  const { rows, count } = await ChannelListing.findAndCountAll({ where,  order:[['createdAt','DESC']], limit, offset });
  return { rows, count, page, limit };
};

module.exports.getById = (id) => id ? ChannelListing.findByPk(id, {  }) : null;
module.exports.create  = (payload={}) => { if(!payload.companyId) throw new Error('companyId is required'); return ChannelListing.create(payload); };
module.exports.update  = async (id, payload={}) => { const it=await ChannelListing.findByPk(id); if(!it) return null; await it.update(payload); return module.exports.getById(id); };
module.exports.remove  = (id) => ChannelListing.destroy({ where:{ id } });
