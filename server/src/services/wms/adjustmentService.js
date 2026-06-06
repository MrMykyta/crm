'use strict';

const { Op } = require('sequelize');
const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const Inventory = require('./inventoryService');
const costingService = require('./costingService');
const {
  Adjustment,
  AdjustmentItem,
  StockMove,
  Product,
  ProductVariant,
} = require('../../models');
const {
  assertDocumentTypeEnabled,
  generateNextDocumentNumber,
} = require('../crm/documentNumberingService');

const ADJUSTMENT_DOCUMENT_TYPES = new Set(['RW', 'PW']);
const ADJUSTMENT_STATUSES = new Set(['draft', 'posted']);

function asText(value) {
  return String(value ?? '').trim();
}

function asOptionalText(value) {
  const text = asText(value);
  return text || null;
}

function asNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function ensureCompanyId(companyId) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', {
      code: 'COMPANY_CONTEXT_REQUIRED',
    });
  }
}

function ensureDocumentType(documentType) {
  const normalized = asText(documentType).toUpperCase();
  if (!ADJUSTMENT_DOCUMENT_TYPES.has(normalized)) {
    throw new AppError(400, 'documentType must be RW or PW', {
      code: 'VALIDATION_ERROR',
    });
  }
  return normalized;
}

function ensureStatus(status) {
  const normalized = asText(status).toLowerCase();
  if (!ADJUSTMENT_STATUSES.has(normalized)) {
    throw new AppError(400, `Invalid status "${status}"`, {
      code: 'VALIDATION_ERROR',
    });
  }
  return normalized;
}

function ensureNonZeroQtyDelta(value) {
  const qty = asNumber(value, NaN);
  if (!Number.isFinite(qty) || qty === 0) {
    throw new AppError(400, 'qtyDelta must be non-zero', {
      code: 'VALIDATION_ERROR',
    });
  }
  return round4(qty);
}

// Resolves per-unit cost for an incoming PW line via AdjustmentItem.unitCost →
// ProductVariant.cost → Product.cost. Throws ADJUSTMENT_UNIT_COST_REQUIRED if all are null,
// instead of silently zero-costing the inbound layer.
async function resolveAdjustmentItemCostInput(item, transaction) {
  let unitCost = item.unitCost === null || item.unitCost === undefined
    ? null
    : Number(item.unitCost);
  let currency = item.currency || null;

  if (!Number.isFinite(unitCost)) {
    const [variant, product] = await Promise.all([
      item.variantId
        ? ProductVariant.findByPk(item.variantId, { attributes: ['id', 'cost', 'currency'], transaction })
        : Promise.resolve(null),
      Product.findByPk(item.productId, { attributes: ['id', 'cost', 'currency'], transaction }),
    ]);
    const variantCost = variant && variant.cost !== null && variant.cost !== undefined ? Number(variant.cost) : null;
    const productCost = product && product.cost !== null && product.cost !== undefined ? Number(product.cost) : null;
    if (Number.isFinite(variantCost)) {
      unitCost = variantCost;
      currency = currency || variant.currency || null;
    } else if (Number.isFinite(productCost)) {
      unitCost = productCost;
      currency = currency || product.currency || null;
    }
  }

  if (!Number.isFinite(unitCost)) {
    throw new AppError(409, 'PW line requires unit cost', {
      code: 'ADJUSTMENT_UNIT_COST_REQUIRED',
      details: {
        adjustmentItemId: item.id,
        productId: item.productId,
        variantId: item.variantId || null,
      },
    });
  }

  return { unitCost, currency: currency || 'PLN' };
}

function ensureQtyDeltaByType(documentType, qtyDelta) {
  if (documentType === 'PW' && qtyDelta <= 0) {
    throw new AppError(409, 'PW item qtyDelta must be greater than 0', {
      code: 'INVALID_QTY_DELTA',
      details: { documentType, qtyDelta },
    });
  }
  if (documentType === 'RW' && qtyDelta >= 0) {
    throw new AppError(409, 'RW item qtyDelta must be less than 0', {
      code: 'INVALID_QTY_DELTA',
      details: { documentType, qtyDelta },
    });
  }
}

function parsePaging(query = {}) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildListWhere(companyId, query = {}) {
  const where = { companyId };
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.documentType) where.documentType = ensureDocumentType(query.documentType);
  if (query.status) where.status = ensureStatus(query.status);
  if (query.q) {
    where[Op.or] = [
      { number: { [Op.iLike]: `%${query.q}%` } },
      { reason: { [Op.iLike]: `%${query.q}%` } },
    ];
  }
  return where;
}

async function getById(companyId, id, options = {}) {
  const transaction = options.transaction || null;
  if (!id) return null;
  return Adjustment.findOne({
    where: { id, companyId },
    include: [{ model: AdjustmentItem, as: 'items' }],
    order: [[{ model: AdjustmentItem, as: 'items' }, 'createdAt', 'ASC']],
    transaction,
  });
}

async function list(companyId, query = {}, options = {}) {
  ensureCompanyId(companyId);
  const transaction = options.transaction || null;
  const { page, limit, offset } = parsePaging(query);
  const where = buildListWhere(companyId, query);

  const { rows, count } = await Adjustment.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    transaction,
  });

  return { rows, count, page, limit };
}

async function create(companyId, data = {}, outerTx = null) {
  ensureCompanyId(companyId);
  return withTx(async (t) => {
    const warehouseId = asOptionalText(data.warehouseId);
    if (!warehouseId) {
      throw new AppError(400, 'warehouseId is required', {
        code: 'VALIDATION_ERROR',
      });
    }

    const documentType = ensureDocumentType(data.documentType || data.type);
    await assertDocumentTypeEnabled({
      companyId,
      documentType,
      transaction: t,
    });

    const issueDate = data.issueDate || new Date();
    const manualNumber = asOptionalText(data.number);
    const generatedNumber = manualNumber
      ? null
      : await generateNextDocumentNumber({
        companyId,
        documentType,
        issueDate,
        transaction: t,
      });
    const number = manualNumber || generatedNumber;
    if (manualNumber) {
      const duplicate = await Adjustment.findOne({
        where: { companyId, documentType, number: manualNumber },
        attributes: ['id'],
        transaction: t,
      });
      if (duplicate) {
        throw new AppError(409, `Number ${manualNumber} is already used for ${documentType}`, {
          code: 'NUMBER_ALREADY_USED',
        });
      }
    }

    const adjustment = await Adjustment.create(
      {
        companyId,
        warehouseId,
        number,
        documentType,
        reason: asOptionalText(data.reason),
        status: 'draft',
      },
      { transaction: t }
    );

    const items = Array.isArray(data.items) ? data.items : [];
    for (const row of items) {
      const qtyDelta = ensureNonZeroQtyDelta(row.qtyDelta);
      ensureQtyDeltaByType(documentType, qtyDelta);
      if (!row.productId) {
        throw new AppError(400, 'productId is required for every item', {
          code: 'VALIDATION_ERROR',
        });
      }
      if (!row.locationId) {
        throw new AppError(400, 'locationId is required for every item', {
          code: 'VALIDATION_ERROR',
        });
      }

      // eslint-disable-next-line no-await-in-loop
      await AdjustmentItem.create(
        {
          companyId,
          adjustmentId: adjustment.id,
          productId: row.productId,
          variantId: row.variantId || null,
          locationId: row.locationId,
          lotId: row.lotId || null,
          serialId: row.serialId || null,
          qtyDelta,
          // PW lines may carry per-unit cost; RW ignores it (cost is derived from FIFO at post time).
          unitCost: row.unitCost === undefined || row.unitCost === null || row.unitCost === '' ? null : Number(row.unitCost),
          currency: row.currency ? String(row.currency).toUpperCase() : null,
        },
        { transaction: t }
      );
    }

    return getById(companyId, adjustment.id, { transaction: t });
  }, outerTx);
}

async function post(companyId, adjustmentId, outerTx = null) {
  ensureCompanyId(companyId);
  return withTx(async (t) => {
    const adjustment = await Adjustment.findOne({
      where: { id: adjustmentId, companyId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!adjustment) return null;

    const documentType = ensureDocumentType(adjustment.documentType);
    const status = ensureStatus(adjustment.status || 'draft');
    if (status === 'posted') {
      return getById(companyId, adjustment.id, { transaction: t });
    }

    const items = await AdjustmentItem.findAll({
      where: { adjustmentId: adjustment.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
      order: [['createdAt', 'ASC']],
    });
    if (!items.length) {
      throw new AppError(409, 'Cannot post adjustment without items', {
        code: 'ADJUSTMENT_EMPTY',
      });
    }

    for (const item of items) {
      const qtyDelta = ensureNonZeroQtyDelta(item.qtyDelta);
      ensureQtyDeltaByType(documentType, qtyDelta);

      // idempotency guard on line-level
      // eslint-disable-next-line no-await-in-loop
      const existingMove = await StockMove.findOne({
        where: {
          companyId,
          type: 'adjustment',
          refType: documentType,
          refId: adjustment.id,
          refItemId: item.id,
        },
        attributes: ['id'],
        transaction: t,
      });
      if (existingMove) {
        // already posted for this line
        // eslint-disable-next-line no-continue
        continue;
      }

      const qty = Math.abs(qtyDelta);
      const fromLocationId = documentType === 'RW' ? item.locationId : null;
      const toLocationId = documentType === 'PW' ? item.locationId : null;

      // eslint-disable-next-line no-await-in-loop
      const move = await Inventory.applyMove(
        {
          companyId,
          type: 'adjustment',
          warehouseId: adjustment.warehouseId,
          fromLocationId,
          toLocationId,
          productId: item.productId,
          variantId: item.variantId || null,
          lotId: item.lotId || null,
          serialId: item.serialId || null,
          qty,
          refType: documentType,
          refId: adjustment.id,
          refItemId: item.id,
        },
        { transaction: t }
      );

      // PW = incoming layer (needs unit cost). RW = FIFO consumption from existing layers.
      if (documentType === 'PW') {
        // eslint-disable-next-line no-await-in-loop
        const costInput = await resolveAdjustmentItemCostInput(item, t);
        // eslint-disable-next-line no-await-in-loop
        await costingService.applyCostingForMove(move, { costInput }, t);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await costingService.applyCostingForMove(move, {}, t);
      }
    }

    await adjustment.update(
      {
        status: 'posted',
        postedAt: adjustment.postedAt || new Date(),
      },
      { transaction: t }
    );

    return getById(companyId, adjustment.id, { transaction: t });
  }, outerTx);
}

async function listStockMoves(companyId, adjustmentId, query = {}, options = {}) {
  ensureCompanyId(companyId);
  const transaction = options.transaction || null;
  if (!adjustmentId) return { rows: [], count: 0, page: 1, limit: 20 };

  const adjustment = await Adjustment.findOne({
    where: { id: adjustmentId, companyId },
    attributes: ['id', 'documentType'],
    transaction,
  });
  if (!adjustment) return null;

  const documentType = ensureDocumentType(adjustment.documentType);
  const { page, limit, offset } = parsePaging(query);
  const where = {
    companyId,
    type: 'adjustment',
    refType: documentType,
    refId: adjustmentId,
  };
  if (query.refItemId) where.refItemId = query.refItemId;

  const { rows, count } = await StockMove.findAndCountAll({
    where,
    order: [['createdAt', 'ASC']],
    limit,
    offset,
    transaction,
  });

  return { rows, count, page, limit };
}

module.exports = {
  list,
  getById,
  create,
  post,
  listStockMoves,
};
