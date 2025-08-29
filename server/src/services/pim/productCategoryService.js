
// productCategoryService.js (generated)
const { Op } = require('sequelize');
const { ProductCategory } = require('../../models');

const parse = (q={})=>{ const page=Math.max(parseInt(q.page||'1',10),1); const limit=Math.min(Math.max(parseInt(q.limit||'20',10),1),200); return { page, limit, offset:(page-1)*limit }; };

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parse(query);
  const where = {};
  if (query.companyId) where.companyId = query.companyId; else if (user?.companyId) where.companyId = user.companyId;
  if (query.productId) where.productId = query.productId;
  if (query.categoryId) where.categoryId = query.categoryId;
  // no free-text search
  const { rows, count } = await ProductCategory.findAndCountAll({ where,  order:[['createdAt','DESC']], limit, offset });
  return { rows, count, page, limit };
};

module.exports.getById = (id) => id ? ProductCategory.findByPk(id, {  }) : null;
module.exports.create  = (payload={}) => { if(!payload.companyId) throw new Error('companyId is required'); return ProductCategory.create(payload); };
module.exports.update  = async (id, payload={}) => { const it=await ProductCategory.findByPk(id); if(!it) return null; await it.update(payload); return module.exports.getById(id); };
module.exports.remove  = (id) => ProductCategory.destroy({ where:{ id } });
