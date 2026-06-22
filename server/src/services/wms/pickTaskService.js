
// pickTaskService.js (generated)
const { Op } = require('sequelize');
const { PickTask, PickWave } = require('../../models');

// parsePaging: парсит и нормализует входные параметры.
const parsePaging = (query = {}) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// buildOrder: собирает служебную структуру для выполнения запроса.
const buildOrder = (query = {}) => {
  const sort = String(query.sort || 'createdAt:desc').split(',').filter(Boolean);
  if (!sort.length) return [['createdAt', 'DESC']];
  return sort.map(s => { const [f,d] = s.split(':'); return [f, (d || 'asc').toUpperCase()]; });
};

// buildWhere: собирает служебную структуру для выполнения запроса.
const resolveCompanyId = ({ query = {}, user = {} } = {}) => query.companyId || user?.companyId || null;

const companyScopeInclude = (companyId) => ({
  model: PickWave,
  as: 'wave',
  attributes: [],
  required: true,
  ...(companyId ? { where: { companyId } } : {}),
});

const buildWhere = (query = {}) => {
  const where = {};
  if (query.waveId) where.waveId = query.waveId;
  if (query.orderId) where.orderId = query.orderId;
  if (query.productId) where.productId = query.productId;
  if (query.status) where.status = query.status;
  if (query.fromLocationId) where.fromLocationId = query.fromLocationId;
  // no free-text search
  return where;
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const companyId = resolveCompanyId({ query, user });
  const where = buildWhere(query);
  const order = buildOrder(query);
  const { rows, count } = await PickTask.findAndCountAll({
    where,
    include: [companyScopeInclude(companyId)],
    order,
    limit,
    offset,
    distinct: true,
  });
  return { rows, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (id, { query = {}, user = {}, transaction = null } = {}) => {
  if (!id) return null;
  const companyId = resolveCompanyId({ query, user });
  return PickTask.findOne({
    where: { id },
    include: [companyScopeInclude(companyId)],
    transaction,
  });
};
// create: создаёт новую запись и возвращает результат.
module.exports.create  = async (payload = {}, { user = {}, transaction = null } = {}) => {
  const companyId = user?.companyId || payload.companyId || null;
  if (!companyId) throw new Error('companyId is required');
  if (!payload.waveId) throw new Error('waveId is required');

  const wave = await PickWave.findOne({ where: { id: payload.waveId, companyId }, transaction });
  if (!wave) throw new Error('wave not found');

  const { companyId: _ignoredCompanyId, ...data } = payload;
  return PickTask.create(data, { transaction });
};
// update: обновляет запись и возвращает актуальные данные.
module.exports.update  = async (id, payload = {}, { user = {}, transaction = null } = {}) => {
  if (!id) throw new Error('id is required');
  const row = await module.exports.getById(id, { user, transaction }); if (!row) return null;
  const { companyId: _ignoredCompanyId, ...data } = payload;

  if (data.waveId && data.waveId !== row.waveId) {
    const companyId = user?.companyId || payload.companyId || null;
    const wave = await PickWave.findOne({ where: { id: data.waveId, companyId }, transaction });
    if (!wave) throw new Error('wave not found');
  }

  await row.update(data, { transaction });
  return module.exports.getById(id, { user, transaction });
};
// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove  = async (id, { user = {}, transaction = null } = {}) => {
  if (!id) return 0;
  const row = await module.exports.getById(id, { user, transaction });
  if (!row) return 0;
  await row.destroy({ transaction });
  return 1;
};
