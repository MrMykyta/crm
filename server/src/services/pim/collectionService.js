
// collectionService.js (generated)
const { Op } = require('sequelize');
const { Collection } = require('../../models');

// parse: парсит и нормализует входные параметры.
const parse = (q={})=>{ const page=Math.max(parseInt(q.page||'1',10),1); const limit=Math.min(Math.max(parseInt(q.limit||'20',10),1),200); return { page, limit, offset:(page-1)*limit }; };

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parse(query);
  const where = {};
  if (query.companyId) where.companyId = query.companyId; else if (user?.companyId) where.companyId = user.companyId;
  if (query.isActive) where.isActive = query.isActive;
  if (query.q) { where[Op.or] = [{ name: { [Op.iLike]: `%${query.q}%` } }, { code: { [Op.iLike]: `%${query.q}%` } }]; }
  const { rows, count } = await Collection.findAndCountAll({ where,  order:[['createdAt','DESC']], limit, offset });
  return { rows, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = (id) => id ? Collection.findByPk(id, {  }) : null;
// create: создаёт новую запись и возвращает результат.
module.exports.create  = (payload={}) => { if(!payload.companyId) throw new Error('companyId is required'); return Collection.create(payload); };
// update: обновляет запись и возвращает актуальные данные.
module.exports.update  = async (id, payload={}) => { const it=await Collection.findByPk(id); if(!it) return null; await it.update(payload); return module.exports.getById(id); };
// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove  = (id) => Collection.destroy({ where:{ id } });

