
// transferOrderService.js (generated)
const { Op } = require('sequelize');
const { TransferOrder, TransferItem, StockMove } = require('../../models');
const { assertDocumentTypeEnabled, generateNextDocumentNumber } = require('../crm/documentNumberingService');
const {
  enrichStockMoveRows,
  enrichTransferDto,
  productInclude,
  resolveTransferMoveLocations,
  sourceLocationInclude,
  sourceWarehouseInclude,
  stockMoveIncludes,
  targetLocationInclude,
  targetWarehouseInclude,
  variantInclude,
} = require('./wmsDto');

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
module.exports.list = async ({ query = {}, user = {}, transaction = null } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await TransferOrder.findAndCountAll({ where,  order, limit, offset, transaction });
  return { rows, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (id, companyId = null, options = {}) => {
  const transaction = options.transaction || null;
  if (!id) return null;
  const where = companyId ? { id, companyId } : { id };
  const row = await TransferOrder.findOne({
    where,
    include: [
      sourceWarehouseInclude,
      targetWarehouseInclude,
      sourceLocationInclude,
      targetLocationInclude,
      { model: TransferItem, as: 'items', include: [productInclude, variantInclude] },
    ],
    order: [[{ model: TransferItem, as: 'items' }, 'createdAt', 'ASC']],
    transaction,
  });
  if (!row) return null;
  const relationOverrides = await resolveTransferMoveLocations({ companyId: row.companyId, transferId: row.id, transaction });
  return enrichTransferDto(row, relationOverrides);
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
  const where = companyId ? { id, companyId } : { id };
  const row = await TransferOrder.findOne({ where });
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

// listStockMovesByTransfer: возвращает историю stock_moves по MM-документу.
module.exports.listStockMovesByTransfer = async (transferId, companyId, query = {}, options = {}) => {
  const transaction = options.transaction || null;
  if (!transferId) return { rows: [], count: 0, page: 1, limit: 20 };
  const transfer = await TransferOrder.findOne({ where: { id: transferId, companyId }, attributes: ['id'], transaction });
  if (!transfer) return null;

  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;

  const where = {
    companyId,
    refType: 'MM',
    refId: transferId,
  };
  if (query.refItemId) where.refItemId = query.refItemId;

  const { rows, count } = await StockMove.findAndCountAll({
    where,
    include: stockMoveIncludes,
    order: [['createdAt', 'ASC']],
    limit,
    offset,
    transaction,
  });

  return { rows: enrichStockMoveRows(rows), count, page, limit };
};

// listStockMovesByTransferItem: возвращает историю stock_moves по строке MM (refItemId).
module.exports.listStockMovesByTransferItem = async (transferItemId, companyId, query = {}, options = {}) => {
  const transaction = options.transaction || null;
  if (!transferItemId) return { rows: [], count: 0, page: 1, limit: 20 };
  const item = await TransferItem.findOne({
    where: { id: transferItemId },
    include: [{ model: TransferOrder, as: 'transfer', attributes: ['id', 'companyId'] }],
    transaction,
  });
  if (!item || !item.transfer || item.transfer.companyId !== companyId) return null;

  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;

  const rows = await StockMove.findAll({
    where: {
      companyId,
      refType: 'MM',
      refId: item.transferId,
      refItemId: item.id,
    },
    include: stockMoveIncludes,
    order: [['createdAt', 'ASC']],
    limit,
    offset,
    transaction,
  });

  // legacy fallback for historical rows without ref_item_id
  let mergedRows = rows;
  if (!rows.length) {
    const legacyRows = await StockMove.findAll({
      where: {
        companyId,
        refType: 'MM',
        refId: item.transferId,
        refItemId: null,
        productId: item.productId,
        variantId: item.variantId ?? null,
        lotId: item.lotId ?? null,
        type: 'transfer',
      },
      include: stockMoveIncludes,
      order: [['createdAt', 'ASC']],
      limit,
      offset,
      transaction,
    });
    mergedRows = legacyRows;
  }

  return {
    rows: enrichStockMoveRows(mergedRows),
    count: mergedRows.length,
    page,
    limit,
  };
};
