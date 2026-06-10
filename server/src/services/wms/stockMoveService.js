
// stockMoveService.js (generated)
const { Op } = require('sequelize');
const { StockMove } = require('../../models');
const { enrichStockMoveDto, enrichStockMoveRows, stockMoveIncludes } = require('./wmsDto');

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
  if (query.variantId) where.variantId = query.variantId;
  if (query.refType) where.refType = query.refType;
  if (query.sourceType && !query.refType) where.refType = query.sourceType;
  if (query.refId) where.refId = query.refId;
  if (query.sourceId && !query.refId) where.refId = query.sourceId;
  if (query.refItemId) where.refItemId = query.refItemId;
  if (query.fromLocationId) where.fromLocationId = query.fromLocationId;
  if (query.toLocationId) where.toLocationId = query.toLocationId;
  if (query.locationId) {
    where[Op.or] = [
      { fromLocationId: query.locationId },
      { toLocationId: query.locationId },
    ];
  }
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  const dateTo = query.dateTo ? new Date(query.dateTo) : null;
  const createdAt = {};
  if (dateFrom && !Number.isNaN(dateFrom.getTime())) createdAt[Op.gte] = dateFrom;
  if (dateTo && !Number.isNaN(dateTo.getTime())) {
    const inclusiveTo = new Date(dateTo);
    inclusiveTo.setHours(23, 59, 59, 999);
    createdAt[Op.lte] = inclusiveTo;
  }
  if (Object.keys(createdAt).length) where.createdAt = createdAt;
  // no free-text search
  return where;
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await StockMove.findAndCountAll({ where, include: stockMoveIncludes, order, limit, offset });
  return { rows: enrichStockMoveRows(rows), count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (id) => {
  if (!id) return null;
  const row = await StockMove.findByPk(id, { include: stockMoveIncludes });
  return enrichStockMoveDto(row);
};
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
    include: stockMoveIncludes,
    order: [['createdAt', 'ASC']],
    limit: l,
    offset,
    transaction,
  });
  return { rows: enrichStockMoveRows(rows), count, page: p, limit: l };
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
    include: stockMoveIncludes,
    order: [['createdAt', 'ASC']],
    limit: l,
    offset,
    transaction,
  });
  return { rows: enrichStockMoveRows(rows), count, page: p, limit: l };
};
