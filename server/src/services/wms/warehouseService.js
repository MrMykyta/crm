
// warehouseService.js (generated)
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Warehouse } = require('../../models');

// parsePaging: парсит и нормализует входные параметры.
const parsePaging = (query = {}) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// buildOrder: собирает служебную структуру для выполнения запроса.
const buildOrder = (query = {}) => {
  const sort = String(query.sort || 'created_at:desc').split(',').filter(Boolean);
  if (!sort.length) return [['createdAt', 'DESC']];
  return sort.map(s => { const [f,d] = s.split(':'); return [f, (d || 'asc').toUpperCase()]; });
};

// buildWhere: собирает служебную структуру для выполнения запроса.
const buildWhere = (query = {}, user = {}) => {
  const where = {};
  if (query.companyId) where.companyId = query.companyId;
  else if (user?.companyId) where.companyId = user.companyId;
  if (query.isActive) where.isActive = query.isActive;
  if (query.q) { where[Op.or] = [{ code: { [Op.iLike]: `%${query.q}%` } }, { name: { [Op.iLike]: `%${query.q}%` } }]; }
  return where;
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await Warehouse.findAndCountAll({ where,  order, limit, offset });
  return { rows, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (id) => id ? Warehouse.findByPk(id, {  }) : null;
// create: создаёт новую запись и возвращает результат.
module.exports.create  = async (payload = {}) => {
  if (!payload.companyId) throw new Error('companyId is required');
  const normalizedPayload = {
    ...payload,
    id: crypto.randomUUID(),
  };
  delete normalizedPayload.createdAt;
  delete normalizedPayload.updatedAt;
  return Warehouse.create(normalizedPayload);
};
// update: обновляет запись и возвращает актуальные данные.
module.exports.update  = async (id, payload = {}) => {
  if (!id) throw new Error('id is required');
  const row = await Warehouse.findByPk(id); if (!row) return null;
  if (payload.companyId && payload.companyId !== row.companyId) throw new Error('companyId mismatch');
  await row.update(payload);
  return module.exports.getById(id);
};
// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove  = async (id) => id ? Warehouse.destroy({ where:{ id } }) : 0;
