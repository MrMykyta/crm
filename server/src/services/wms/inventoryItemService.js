
// inventoryItemService.js (generated)
const { Op } = require('sequelize');
const { InventoryItem, Warehouse, Location, Product, ProductVariant } = require('../../models');

const parsePaging = (query = {}) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const buildOrder = (query = {}) => {
  const sort = String(query.sort || 'updated_at:desc').split(',').filter(Boolean);
  if (!sort.length) return [['createdAt', 'DESC']];
  return sort.map(s => { const [f,d] = s.split(':'); return [f, (d || 'asc').toUpperCase()]; });
};

const buildWhere = (query = {}, user = {}) => {
  const where = {};
  if (query.companyId) where.companyId = query.companyId;
  else if (user?.companyId) where.companyId = user.companyId;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.locationId) where.locationId = query.locationId;
  if (query.productId) where.productId = query.productId;
  if (query.variantId) where.variantId = query.variantId;
  if (query.lotId) where.lotId = query.lotId;
  if (query.serialId) where.serialId = query.serialId;
  // no free-text search
  return where;
};

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await InventoryItem.findAndCountAll({ where, include: [{ model: Warehouse, as:'warehouse' }, { model: Location,  as:'location' }, { model: Product,   as:'product' }, { model: ProductVariant, as:'variant' }], order, limit, offset });
  return { rows, count, page, limit };
};

module.exports.getById = async (id) => id ? InventoryItem.findByPk(id, { include: [{ model: Warehouse, as:'warehouse' }, { model: Location,  as:'location' }, { model: Product,   as:'product' }, { model: ProductVariant, as:'variant' }], }) : null;
module.exports.create  = async (payload = {}) => {
  if (!payload.companyId) throw new Error('companyId is required');
  return InventoryItem.create(payload);
};
module.exports.update  = async (id, payload = {}) => {
  if (!id) throw new Error('id is required');
  const row = await InventoryItem.findByPk(id); if (!row) return null;
  if (payload.companyId && payload.companyId !== row.companyId) throw new Error('companyId mismatch');
  await row.update(payload);
  return module.exports.getById(id);
};
module.exports.remove  = async (id) => id ? InventoryItem.destroy({ where:{ id } }) : 0;
