'use strict';

const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const {
  CycleCount,
  CountItem,
  InventoryItem,
} = require('../../models');
const adjustmentService = require('./adjustmentService');
const {
  enrichCycleCountDto,
  itemLocationInclude,
  productInclude,
  variantInclude,
  warehouseInclude,
} = require('./wmsDto');

const CYCLE_STATUSES = new Set(['planned', 'counting', 'reconciled']);

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

function ensureCycleStatus(value, { allowReconciled = true } = {}) {
  const normalized = asText(value || 'planned').toLowerCase();
  if (!CYCLE_STATUSES.has(normalized)) {
    throw new AppError(400, `Invalid cycle count status "${value}"`, {
      code: 'VALIDATION_ERROR',
    });
  }
  if (!allowReconciled && normalized === 'reconciled') {
    throw new AppError(409, 'Cannot modify reconciled cycle count', {
      code: 'CYCLE_COUNT_ALREADY_RECONCILED',
    });
  }
  return normalized;
}

function ensureWarehouseId(value) {
  const warehouseId = asOptionalText(value);
  if (!warehouseId) {
    throw new AppError(400, 'warehouseId is required', {
      code: 'VALIDATION_ERROR',
    });
  }
  return warehouseId;
}

function normalizeCountItemInput(raw = {}) {
  const locationId = asOptionalText(raw.locationId);
  const productId = asOptionalText(raw.productId);
  const qtyCounted = asNumber(
    raw.qtyCounted ?? raw.countedQty ?? raw.qty ?? raw.quantity,
    NaN
  );
  if (!locationId) {
    throw new AppError(400, 'locationId is required for every count item', {
      code: 'VALIDATION_ERROR',
    });
  }
  if (!productId) {
    throw new AppError(400, 'productId is required for every count item', {
      code: 'VALIDATION_ERROR',
    });
  }
  if (!Number.isFinite(qtyCounted) || qtyCounted < 0) {
    throw new AppError(400, 'qtyCounted must be a number >= 0', {
      code: 'VALIDATION_ERROR',
    });
  }

  return {
    locationId,
    productId,
    variantId: asOptionalText(raw.variantId),
    lotId: asOptionalText(raw.lotId),
    serialId: asOptionalText(raw.serialId),
    qtyCounted: round4(qtyCounted),
  };
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
  if (query.status) where.status = ensureCycleStatus(query.status);
  return where;
}

async function getCycleCountById(companyId, cycleCountId, options = {}) {
  ensureCompanyId(companyId);
  const transaction = options.transaction || null;
  if (!cycleCountId) return null;

  const row = await CycleCount.findOne({
    where: { id: cycleCountId, companyId },
    include: [
      warehouseInclude,
      {
        model: CountItem,
        as: 'items',
        include: [itemLocationInclude, productInclude, variantInclude],
      },
    ],
    order: [[{ model: CountItem, as: 'items' }, 'createdAt', 'ASC']],
    transaction,
  });
  return enrichCycleCountDto(row);
}

async function listCycleCounts(companyId, query = {}, options = {}) {
  ensureCompanyId(companyId);
  const transaction = options.transaction || null;
  const { page, limit, offset } = parsePaging(query);
  const where = buildListWhere(companyId, query);
  const { rows, count } = await CycleCount.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    transaction,
  });
  return { rows: rows.map(enrichCycleCountDto), count, page, limit };
}

async function createCycleCount(companyId, payload = {}, options = {}) {
  ensureCompanyId(companyId);
  return withTx(async (t) => {
    const warehouseId = ensureWarehouseId(payload.warehouseId);
    const status = ensureCycleStatus(payload.status || 'planned', {
      allowReconciled: false,
    });

    const cycleCount = await CycleCount.create(
      {
        companyId,
        warehouseId,
        status,
      },
      { transaction: t }
    );

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length) {
      await addCountItems(cycleCount.id, items, { companyId, transaction: t });
    }

    return getCycleCountById(companyId, cycleCount.id, { transaction: t });
  }, options.transaction || null);
}

async function addCountItems(cycleCountId, items = [], options = {}) {
  const companyId = options.companyId;
  ensureCompanyId(companyId);
  if (!cycleCountId) {
    throw new AppError(400, 'cycleCountId is required', { code: 'VALIDATION_ERROR' });
  }

  return withTx(async (t) => {
    const cycleCount = await CycleCount.findOne({
      where: { id: cycleCountId, companyId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!cycleCount) return null;

    const status = ensureCycleStatus(cycleCount.status, { allowReconciled: true });
    if (status === 'reconciled') {
      throw new AppError(409, 'Cycle count already reconciled', {
        code: 'CYCLE_COUNT_ALREADY_RECONCILED',
      });
    }

    if (!Array.isArray(items) || !items.length) {
      throw new AppError(400, 'items must be a non-empty array', {
        code: 'VALIDATION_ERROR',
      });
    }

    const normalized = items.map(normalizeCountItemInput);
    await CountItem.bulkCreate(
      normalized.map((row) => ({
        countId: cycleCount.id,
        locationId: row.locationId,
        productId: row.productId,
        variantId: row.variantId,
        lotId: row.lotId,
        serialId: row.serialId,
        qtyCounted: row.qtyCounted,
      })),
      { transaction: t }
    );

    if (status === 'planned') {
      await cycleCount.update({ status: 'counting' }, { transaction: t });
    }

    return getCycleCountById(companyId, cycleCount.id, { transaction: t });
  }, options.transaction || null);
}

function buildReconcileKey(item) {
  return [
    item.locationId,
    item.productId,
    item.variantId || 'null',
    item.lotId || 'null',
    item.serialId || 'null',
  ].join('|');
}

async function resolveSystemQty(companyId, warehouseId, line, transaction) {
  const qty = await InventoryItem.sum('qtyOnHand', {
    where: {
      companyId,
      warehouseId,
      locationId: line.locationId,
      productId: line.productId,
      variantId: line.variantId ?? null,
      lotId: line.lotId ?? null,
      serialId: line.serialId ?? null,
    },
    transaction,
  });
  return round4(asNumber(qty, 0));
}

async function reconcileCycleCount(cycleCountId, options = {}) {
  const companyId = options.companyId;
  ensureCompanyId(companyId);
  if (!cycleCountId) {
    throw new AppError(400, 'cycleCountId is required', { code: 'VALIDATION_ERROR' });
  }

  return withTx(async (t) => {
    const cycleCount = await CycleCount.findOne({
      where: { id: cycleCountId, companyId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!cycleCount) return null;

    if (cycleCount.status === 'reconciled') {
      const row = await getCycleCountById(companyId, cycleCount.id, { transaction: t });
      return { cycleCount: row, adjustments: [] };
    }

    const items = await CountItem.findAll({
      where: { countId: cycleCount.id },
      order: [['createdAt', 'ASC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!items.length) {
      throw new AppError(409, 'Cannot reconcile cycle count without items', {
        code: 'CYCLE_COUNT_EMPTY',
      });
    }

    const grouped = new Map();
    for (const item of items) {
      const key = buildReconcileKey(item);
      const prev = grouped.get(key);
      const qtyCounted = round4(asNumber(item.qtyCounted, 0));
      if (prev) {
        prev.qtyCounted = round4(prev.qtyCounted + qtyCounted);
      } else {
        grouped.set(key, {
          locationId: item.locationId,
          productId: item.productId,
          variantId: item.variantId || null,
          lotId: item.lotId || null,
          serialId: item.serialId || null,
          qtyCounted,
        });
      }
    }

    const pwItems = [];
    const rwItems = [];

    for (const line of grouped.values()) {
      // eslint-disable-next-line no-await-in-loop
      const systemQty = await resolveSystemQty(companyId, cycleCount.warehouseId, line, t);
      const delta = round4(line.qtyCounted - systemQty);
      if (delta === 0) continue;

      const adjustmentItem = {
        productId: line.productId,
        variantId: line.variantId,
        locationId: line.locationId,
        lotId: line.lotId,
        serialId: line.serialId,
        qtyDelta: delta,
      };
      if (delta > 0) {
        pwItems.push(adjustmentItem);
      } else {
        rwItems.push(adjustmentItem);
      }
    }

    const adjustments = [];
    if (pwItems.length) {
      const pwDraft = await adjustmentService.create(
        companyId,
        {
          warehouseId: cycleCount.warehouseId,
          documentType: 'PW',
          reason: `Cycle count ${cycleCount.id} reconcile`,
          items: pwItems,
        },
        t
      );
      const pwPosted = await adjustmentService.post(companyId, pwDraft.id, t);
      adjustments.push({
        documentType: 'PW',
        id: pwPosted.id,
        number: pwPosted.number,
        status: pwPosted.status,
        itemsCount: Array.isArray(pwPosted.items) ? pwPosted.items.length : pwItems.length,
      });
    }

    if (rwItems.length) {
      const rwDraft = await adjustmentService.create(
        companyId,
        {
          warehouseId: cycleCount.warehouseId,
          documentType: 'RW',
          reason: `Cycle count ${cycleCount.id} reconcile`,
          items: rwItems,
        },
        t
      );
      const rwPosted = await adjustmentService.post(companyId, rwDraft.id, t);
      adjustments.push({
        documentType: 'RW',
        id: rwPosted.id,
        number: rwPosted.number,
        status: rwPosted.status,
        itemsCount: Array.isArray(rwPosted.items) ? rwPosted.items.length : rwItems.length,
      });
    }

    await cycleCount.update(
      {
        status: 'reconciled',
      },
      { transaction: t }
    );

    const row = await getCycleCountById(companyId, cycleCount.id, { transaction: t });
    return { cycleCount: row, adjustments };
  }, options.transaction || null);
}

module.exports = {
  listCycleCounts,
  getCycleCountById,
  createCycleCount,
  addCountItems,
  reconcileCycleCount,
};
