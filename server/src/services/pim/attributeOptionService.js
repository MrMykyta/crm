
// attributeOptionService.js (generated)
const { Op } = require('sequelize');
const { AttributeOption } = require('../../models');

const parse = (q={})=>{ const page=Math.max(parseInt(q.page||'1',10),1); const limit=Math.min(Math.max(parseInt(q.limit||'20',10),1),200); return { page, limit, offset:(page-1)*limit }; };

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parse(query);
  const where = {};
  if (query.companyId) where.companyId = query.companyId; else if (user?.companyId) where.companyId = user.companyId;
  if (query.attributeId) where.attributeId = query.attributeId;
  if (query.q) { where[Op.or] = [{ value: { [Op.iLike]: `%${query.q}%` } }, { code: { [Op.iLike]: `%${query.q}%` } }]; }
  const { rows, count } = await AttributeOption.findAndCountAll({ where,  order:[['createdAt','DESC']], limit, offset });
  return { rows, count, page, limit };
};

module.exports.getById = (id) => id ? AttributeOption.findByPk(id, {  }) : null;
module.exports.create  = (payload={}) => { if(!payload.companyId) throw new Error('companyId is required'); return AttributeOption.create(payload); };
module.exports.update  = async (id, payload={}) => { const it=await AttributeOption.findByPk(id); if(!it) return null; await it.update(payload); return module.exports.getById(id); };
module.exports.remove  = (id) => AttributeOption.destroy({ where:{ id } });
