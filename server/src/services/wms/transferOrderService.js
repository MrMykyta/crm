
// transferOrderService.js (generated)
const { Op } = require('sequelize');
const { TransferOrder } = require('../../models');
const { assertDocumentTypeEnabled, generateNextDocumentNumber } = require('../crm/documentNumberingService');

function asText(value) {
  return String(value ?? '').trim();
}

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

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await TransferOrder.findAndCountAll({ where,  order, limit, offset });
  return { rows, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (id, companyId = null) => {
  if (!id) return null;
  const where = companyId ? { id, companyId } : { id };
  return TransferOrder.findOne({ where });
};
// create: создаёт новую запись и возвращает результат.
module.exports.create  = async (payload = {}) => {
  if (!payload.companyId) throw new Error('companyId is required');
  const tx = await TransferOrder.sequelize.transaction();
  try {
    const manualNumber = asText(payload.number);
    await assertDocumentTypeEnabled({
      companyId: payload.companyId,
      documentType: 'MM',
      transaction: tx,
    });
    const generatedNumber = manualNumber
      ? null
      : await generateNextDocumentNumber({
        companyId: payload.companyId,
        documentType: 'MM',
        issueDate: payload.issueDate || new Date(),
        transaction: tx,
      });
    const created = await TransferOrder.create(
      {
        ...payload,
        number: manualNumber || generatedNumber,
        status: payload.status || 'draft',
      },
      { transaction: tx }
    );
    await tx.commit();
    return created;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};
// update: обновляет запись и возвращает актуальные данные.
module.exports.update  = async (id, payload = {}, companyId = null) => {
  if (!id) throw new Error('id is required');
  const row = await module.exports.getById(id, companyId);
  if (!row) return null;
  if (payload.companyId && payload.companyId !== row.companyId) throw new Error('companyId mismatch');
  await row.update(payload);
  return module.exports.getById(id, row.companyId);
};
// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove  = async (id, companyId = null) => {
  if (!id) return 0;
  const where = companyId ? { id, companyId } : { id };
  return TransferOrder.destroy({ where });
};
