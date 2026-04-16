
// productAttachmentService.js (generated)
const { Op } = require('sequelize');
const { ProductAttachment } = require('../../models');

// parse: парсит и нормализует входные параметры.
const parse = (q={})=>{ const page=Math.max(parseInt(q.page||'1',10),1); const limit=Math.min(Math.max(parseInt(q.limit||'20',10),1),200); return { page, limit, offset:(page-1)*limit }; };

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parse(query);
  const where = {};
  if (query.companyId) where.companyId = query.companyId; else if (user?.companyId) where.companyId = user.companyId;
  if (query.productId) where.productId = query.productId;
  // no free-text search
  const { rows, count } = await ProductAttachment.findAndCountAll({ where,  order:[['createdAt','DESC']], limit, offset });
  return { rows, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = (id) => id ? ProductAttachment.findByPk(id, {  }) : null;
// create: создаёт новую запись и возвращает результат.
module.exports.create  = (payload={}) => { if(!payload.companyId) throw new Error('companyId is required'); return ProductAttachment.create(payload); };
// update: обновляет запись и возвращает актуальные данные.
module.exports.update  = async (id, payload={}) => { const it=await ProductAttachment.findByPk(id); if(!it) return null; await it.update(payload); return module.exports.getById(id); };
// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove  = (id) => ProductAttachment.destroy({ where:{ id } });

