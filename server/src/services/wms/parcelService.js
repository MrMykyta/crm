
// parcelService.js (generated)
const { Op } = require('sequelize');
const { Parcel, Shipment } = require('../../models');

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

// buildWhere: фильтры по собственным полям Parcel.
// ВНИМАНИЕ: у Parcel НЕТ company_id — фильтрация по компании выполняется через
// include на Shipment (см. companyScopeInclude), а не через where.companyId.
const buildWhere = (query = {}) => {
  const where = {};
  if (query.shipmentId) where.shipmentId = query.shipmentId;
  if (query.q) { where[Op.or] = [{ trackingNumber: { [Op.iLike]: `%${query.q}%` } }, { carrier: { [Op.iLike]: `%${query.q}%` } }]; }
  return where;
};

// resolveCompanyId: компания берётся из явного query.companyId либо из контекста пользователя.
const resolveCompanyId = ({ query = {}, user = {} } = {}) => query.companyId || user?.companyId || null;

// companyScopeInclude: company scoping через связь Parcel -> Shipment -> companyId.
// required: true => INNER JOIN, поэтому посылки чужой компании в выборку не попадают.
// attributes: [] => данные отгрузки не добавляются в ответ (форма ответа не меняется).
const companyScopeInclude = (companyId) => ({
  model: Shipment,
  as: 'shipment',
  attributes: [],
  required: true,
  ...(companyId ? { where: { companyId } } : {}),
});

// list: возвращает список записей с фильтрами, сортировкой и пагинацией (в рамках компании).
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const companyId = resolveCompanyId({ query, user });
  const { rows, count } = await Parcel.findAndCountAll({
    where: buildWhere(query),
    include: [companyScopeInclude(companyId)],
    order: buildOrder(query),
    limit,
    offset,
    distinct: true, // корректный count при INNER JOIN на shipments
  });
  return { rows, count, page, limit };
};

// getById: возвращает посылку только если её отгрузка принадлежит компании пользователя.
module.exports.getById = async (id, { user = {} } = {}) => {
  if (!id) return null;
  const companyId = user?.companyId || null;
  return Parcel.findOne({
    where: { id },
    include: [companyScopeInclude(companyId)],
  });
};

// create: создаёт посылку; целевая отгрузка должна принадлежать компании пользователя.
// Parcel не имеет company_id — любой companyId из payload игнорируется.
module.exports.create = async (payload = {}, { user = {} } = {}) => {
  const companyId = user?.companyId || null;
  if (!payload.shipmentId) throw new Error('shipmentId is required');

  const shipment = await Shipment.findOne({
    attributes: ['id'],
    where: companyId ? { id: payload.shipmentId, companyId } : { id: payload.shipmentId },
  });
  if (!shipment) throw new Error('Shipment not found in company');

  const { companyId: _ignoredCompanyId, ...data } = payload;
  return Parcel.create(data);
};

// update: обновляет посылку только в рамках компании пользователя.
module.exports.update = async (id, payload = {}, { user = {} } = {}) => {
  if (!id) throw new Error('id is required');
  const companyId = user?.companyId || null;

  const row = await Parcel.findOne({
    where: { id },
    include: [companyScopeInclude(companyId)],
  });
  if (!row) return null; // не найдено ИЛИ принадлежит другой компании

  // Parcel не имеет company_id — companyId из payload не сохраняется.
  const { companyId: _ignoredCompanyId, ...data } = payload;
  await row.update(data);
  return module.exports.getById(id, { user });
};

// remove: удаляет посылку только в рамках компании пользователя.
module.exports.remove = async (id, { user = {} } = {}) => {
  if (!id) return 0;
  const companyId = user?.companyId || null;

  const row = await Parcel.findOne({
    attributes: ['id'],
    where: { id },
    include: [companyScopeInclude(companyId)],
  });
  if (!row) return 0; // не найдено ИЛИ принадлежит другой компании

  return Parcel.destroy({ where: { id } });
};
