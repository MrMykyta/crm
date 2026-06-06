
// stockMoveService.js (generated)
const { Op } = require('sequelize');
const { StockMove } = require('../../models');

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
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.type) where.type = query.type;
  if (query.productId) where.productId = query.productId;
  if (query.refType) where.refType = query.refType;
  if (query.refId) where.refId = query.refId;
  if (query.refItemId) where.refItemId = query.refItemId;
  // no free-text search
  return where;
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await StockMove.findAndCountAll({ where,  order, limit, offset });
  return { rows, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (id) => id ? StockMove.findByPk(id, {  }) : null;
// create: создаёт новую запись и возвращает результат.
module.exports.create  = async (payload = {}) => {
  if (!payload.companyId) throw new Error('companyId is required');
  return StockMove.create(payload);
};
// update: обновляет запись и возвращает актуальные данные.
module.exports.update  = async (id, payload = {}) => {
  if (!id) throw new Error('id is required');
  const row = await StockMove.findByPk(id); if (!row) return null;
  if (payload.companyId && payload.companyId !== row.companyId) throw new Error('companyId mismatch');
  await row.update(payload);
  return module.exports.getById(id);
};
// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove  = async (id) => id ? StockMove.destroy({ where:{ id } }) : 0;

// listHistoryByDocument: история движений по документу (refType/refId).
module.exports.listHistoryByDocument = async ({ companyId, refType, refId, refItemId, page, limit, transaction = null } = {}) => {
  if (!companyId || !refType || !refId) return { rows: [], count: 0, page: 1, limit: 20 };
  const { page: p, limit: l, offset } = parsePaging({ page, limit });
  const where = { companyId, refType, refId };
  if (refItemId) where.refItemId = refItemId;

  const { rows, count } = await StockMove.findAndCountAll({
    where,
    order: [['createdAt', 'ASC']],
    limit: l,
    offset,
    transaction,
  });
  return { rows, count, page: p, limit: l };
};

// listHistoryByProduct: история движений по товару (productId + optional variantId).
module.exports.listHistoryByProduct = async ({ companyId, productId, variantId, refItemId, page, limit, transaction = null } = {}) => {
  if (!companyId || !productId) return { rows: [], count: 0, page: 1, limit: 20 };
  const { page: p, limit: l, offset } = parsePaging({ page, limit });
  const where = { companyId, productId };
  if (variantId) where.variantId = variantId;
  if (refItemId) where.refItemId = refItemId;

  const { rows, count } = await StockMove.findAndCountAll({
    where,
    order: [['createdAt', 'ASC']],
    limit: l,
    offset,
    transaction,
  });
  return { rows, count, page: p, limit: l };
};
