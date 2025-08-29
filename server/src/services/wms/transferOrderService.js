
// transferOrderService.js (generated)
const { Op } = require('sequelize');
const { TransferOrder } = require('../../models');

const parsePaging = (query = {}) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const buildOrder = (query = {}) => {
  const sort = String(query.sort || 'createdAt:desc').split(',').filter(Boolean);
  if (!sort.length) return [['createdAt', 'DESC']];
  return sort.map(s => { const [f,d] = s.split(':'); return [f, (d || 'asc').toUpperCase()]; });
};

const buildWhere = (query = {}, user = {}) => {
  const where = {};
  if (query.companyId) where.companyId = query.companyId;
  else if (user?.companyId) where.companyId = user.companyId;
  if (query.fromWarehouseId) where.fromWarehouseId = query.fromWarehouseId;
  if (query.toWarehouseId) where.toWarehouseId = query.toWarehouseId;
  if (query.status) where.status = query.status;
  if (query.q) { where[Op.or] = [{ number: { [Op.iLike]: `%${query.q}%` } }]; }
  return where;
};

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await TransferOrder.findAndCountAll({ where,  order, limit, offset });
  return { rows, count, page, limit };
};

module.exports.getById = async (id) => id ? TransferOrder.findByPk(id, {  }) : null;
module.exports.create  = async (payload = {}) => {
  if (!payload.companyId) throw new Error('companyId is required');
  return TransferOrder.create(payload);
};
module.exports.update  = async (id, payload = {}) => {
  if (!id) throw new Error('id is required');
  const row = await TransferOrder.findByPk(id); if (!row) return null;
  if (payload.companyId && payload.companyId !== row.companyId) throw new Error('companyId mismatch');
  await row.update(payload);
  return module.exports.getById(id);
};
module.exports.remove  = async (id) => id ? TransferOrder.destroy({ where:{ id } }) : 0;
