'use strict';

const { withTx } = require('../../utils/tx');
const { Op } = require('sequelize');
const AppError = require('../../errors/AppError');
const Inventory = require('./inventoryService');
const costingService = require('./costingService');
const { resolveDefaultWarehouseId } = require('./warehouseResolver');
const { Receipt, ReceiptItem, StockMove, CostLayer, Product, ProductVariant } = require('../../models');
const { assertDocumentTypeEnabled, generateNextDocumentNumber } = require('../crm/documentNumberingService');
const {
  enrichReceiptDto,
  enrichStockMoveRows,
  inboundLocationInclude,
  productInclude,
  stockMoveIncludes,
  variantInclude,
  warehouseInclude,
} = require('./wmsDto');

function asText(value) {
  return String(value ?? '').trim();
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

function toPositiveQty(value) {
  const parsed = asNumber(value, NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(400, 'qty must be greater than 0', { code: 'VALIDATION_ERROR' });
  }
  return parsed;
}

function asOptionalUuid(value) {
  const text = asText(value);
  return text || null;
}

function asOptionalMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = asNumber(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function currencyOrNull(value) {
  const text = asText(value).toUpperCase();
  return text || null;
}

function computeTotalCost(qtyExpected, unitCost) {
  const qty = asNumber(qtyExpected, 0);
  const cost = asOptionalMoney(unitCost);
  if (!Number.isFinite(cost)) return null;
  return round4(qty * cost);
}

async function assertDraftReceiptEditable(receipt, transaction) {
  if (!receipt) return null;
  if (receipt.parentDocumentId) {
    throw new AppError(409, 'Correction receipt documents are immutable', {
      code: 'CORRECTION_DOCUMENT_IMMUTABLE',
      details: { receiptId: receipt.id, parentDocumentId: receipt.parentDocumentId },
    });
  }
  if (receipt.status !== 'draft') {
    throw new AppError(409, 'Receipt must be draft to edit', {
      code: 'RECEIPT_NOT_DRAFT',
      details: { receiptId: receipt.id, status: receipt.status },
    });
  }

  const [receivedCount, moveCount] = await Promise.all([
    ReceiptItem.count({
      where: {
        receiptId: receipt.id,
        qtyReceived: { [Op.gt]: 0 },
      },
      transaction,
    }),
    StockMove.count({
      where: {
        companyId: receipt.companyId,
        refType: 'PZ',
        refId: receipt.id,
      },
      transaction,
    }),
  ]);

  if (receivedCount > 0 || moveCount > 0) {
    throw new AppError(409, 'Receipt cannot be edited after receiving has started', {
      code: 'RECEIPT_ALREADY_RECEIVED',
      details: { receiptId: receipt.id, receivedCount, moveCount },
    });
  }

  return receipt;
}

async function loadEditableDraftReceipt(companyId, receiptId, transaction) {
  if (!receiptId) {
    throw new AppError(400, 'receiptId is required', { code: 'VALIDATION_ERROR' });
  }
  const receipt = await Receipt.findOne({
    where: { id: receiptId, companyId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (!receipt) return null;
  await assertDraftReceiptEditable(receipt, transaction);
  return receipt;
}

function buildDraftItemPayload(payload = {}, existing = null) {
  const productId = payload.productId !== undefined
    ? asOptionalUuid(payload.productId)
    : existing?.productId || null;
  if (!productId) {
    throw new AppError(400, 'productId is required', { code: 'VALIDATION_ERROR' });
  }

  const qtySource = payload.qtyExpected !== undefined ? payload.qtyExpected : payload.qty;
  const qtyExpected = qtySource !== undefined
    ? toPositiveQty(qtySource)
    : asNumber(existing?.qtyExpected, NaN);
  if (!Number.isFinite(qtyExpected) || qtyExpected <= 0) {
    throw new AppError(400, 'qtyExpected must be greater than 0', { code: 'VALIDATION_ERROR' });
  }

  const nextUnitCost = payload.unitCost !== undefined
    ? asOptionalMoney(payload.unitCost)
    : (existing ? asOptionalMoney(existing.unitCost) : null);

  return {
    productId,
    variantId: payload.variantId !== undefined ? asOptionalUuid(payload.variantId) : existing?.variantId ?? null,
    lotNumber: payload.lotNumber !== undefined ? asText(payload.lotNumber) || null : existing?.lotNumber ?? null,
    serialNumber: payload.serialNumber !== undefined ? asText(payload.serialNumber) || null : existing?.serialNumber ?? null,
    qtyExpected: round4(qtyExpected),
    qtyReceived: 0,
    unitCost: nextUnitCost,
    totalCost: computeTotalCost(qtyExpected, nextUnitCost),
    currency: payload.currency !== undefined ? currencyOrNull(payload.currency) : existing?.currency ?? null,
  };
}

// Resolves the per-unit cost for an incoming PZ line using the documented fallback chain:
// ReceiptItem.unitCost → ProductVariant.cost → Product.cost. Throws if none provide a value,
// instead of silently defaulting to 0 (matches WMS_OPENING_BALANCE_PLAN §6.1 / G1.2c).
async function resolveReceiptItemCostInput(item, transaction) {
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
    throw new AppError(409, 'PZ line requires unit cost', {
      code: 'RECEIPT_UNIT_COST_REQUIRED',
      details: {
        receiptItemId: item.id,
        productId: item.productId,
        variantId: item.variantId || null,
      },
    });
  }

  return { unitCost, currency: currency || 'PLN' };
}

function parsePaging(query = {}) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function asSearch(value) {
  return asText(value || '').toLowerCase();
}

function buildListWhere(companyId, query = {}) {
  const where = { companyId };
  if (query.status) where.status = query.status;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.number) where.number = query.number;
  if (query.q) {
    where[Op.or] = [{ number: { [Op.iLike]: `%${query.q}%` } }];
  }
  return where;
}

// create: создаёт новую запись и возвращает результат.
module.exports.create = async (companyId, data, outerTx = null) => {
  return withTx(async (t) => {
    const { items = [], ...core } = data || {};
    const issueDate = core.issueDate || new Date();
    const warehouseId = core.warehouseId || (await resolveDefaultWarehouseId(companyId, { transaction: t }));
    const manualNumber = asText(core.number);
    await assertDocumentTypeEnabled({
      companyId,
      documentType: 'PZ',
      transaction: t,
    });
    const generatedNumber = manualNumber
      ? null
      : await generateNextDocumentNumber({
        companyId,
        documentType: 'PZ',
        issueDate,
        transaction: t,
      });
    const number = manualNumber || generatedNumber;

    const receipt = await Receipt.create(
      {
        ...core,
        companyId,
        warehouseId,
        number,
        status: core.status || 'draft',
      },
      { transaction: t }
    );

    if (Array.isArray(items) && items.length) {
      await ReceiptItem.bulkCreate(
        items.map((item) => ({
          ...item,
          receiptId: receipt.id,
          qtyExpected: asNumber(item.qtyExpected ?? item.qty, 0),
          qtyReceived: asNumber(item.qtyReceived, 0),
        })),
        { transaction: t }
      );
    }

    return module.exports.getById(companyId, receipt.id, { transaction: t });
  }, outerTx);
};

// receiveLine: выполняет вспомогательную бизнес-логику сервиса.
module.exports.receiveLine = async (companyId, receiptItemId, { qty, lotId = null }, outerTx = null) => {
  return withTx(async (t) => {
    const moveQty = toPositiveQty(qty);
    const item = await ReceiptItem.findOne({
      where: { id: receiptItemId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!item) return null;

    const receipt = await Receipt.findOne({
      where: { id: item.receiptId, companyId },
      attributes: ['id', 'companyId', 'warehouseId', 'inboundLocationId', 'status', 'parentDocumentId'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!receipt) return null;
    if (receipt.parentDocumentId) {
      throw new AppError(409, 'Correction receipt documents are immutable', {
        code: 'CORRECTION_DOCUMENT_IMMUTABLE',
        details: { receiptId: receipt.id, parentDocumentId: receipt.parentDocumentId },
      });
    }
    if (receipt.status !== 'draft') {
      throw new AppError(409, 'Receipt must be draft to receive', {
        code: 'RECEIPT_NOT_DRAFT',
        details: { receiptId: receipt.id, status: receipt.status },
      });
    }

    const qtyExpected = asNumber(item.qtyExpected, 0);
    const qtyReceived = asNumber(item.qtyReceived, 0);
    const isClosed = qtyReceived >= qtyExpected;
    if (isClosed) {
      const alreadyMovedByLine = await StockMove.findOne({
        where: {
          companyId,
          refType: 'PZ',
          refId: item.receiptId,
          refItemId: item.id,
          type: 'receipt',
        },
        attributes: ['id'],
        transaction: t,
      });
      if (alreadyMovedByLine) {
        return item.reload({ transaction: t });
      }

      // Backward-compatibility for historical stock_moves created before ref_item_id.
      const alreadyMovedLegacy = await StockMove.findOne({
        where: {
          companyId,
          refType: 'PZ',
          refId: item.receiptId,
          refItemId: null,
          productId: item.productId,
          variantId: item.variantId ?? null,
          lotId: lotId ?? null,
          type: 'receipt',
        },
        attributes: ['id'],
        transaction: t,
      });
      if (alreadyMovedLegacy) {
        return item.reload({ transaction: t });
      }
      throw new AppError(409, 'Receipt item already fully received', {
        code: 'RECEIPT_ITEM_ALREADY_RECEIVED',
      });
    }

    const nextQtyReceived = round4(qtyReceived + moveQty);
    if (nextQtyReceived > round4(qtyExpected)) {
      throw new AppError(409, 'qtyReceived cannot exceed qtyExpected', {
        code: 'QTY_EXCEEDS_EXPECTED',
        details: {
          qtyExpected,
          qtyReceived,
          requestedQty: moveQty,
        },
      });
    }

    const move = await Inventory.applyMove(
      {
        companyId,
        type: 'receipt',
        warehouseId: receipt.warehouseId,
        toLocationId: receipt.inboundLocationId || null,
        productId: item.productId,
        variantId: item.variantId,
        lotId,
        qty: moveQty,
        refType: 'PZ',
        refId: item.receiptId,
        refItemId: item.id,
      },
      { transaction: t }
    );

    const costInput = await resolveReceiptItemCostInput(item, t);
    await costingService.applyCostingForMove(move, { costInput }, t);

    await item.update({ qtyReceived: nextQtyReceived }, { transaction: t });

    const all = await ReceiptItem.findAll({
      where: { receiptId: item.receiptId },
      transaction: t,
    });
    const done = all.every((row) => asNumber(row.qtyExpected, 0) <= asNumber(row.qtyReceived, 0));
    if (done) {
      await Receipt.update(
        { status: 'received' },
        { where: { companyId, id: item.receiptId }, transaction: t }
      );
    }

    return item.reload({ transaction: t });
  }, outerTx);
};

module.exports.updateDraft = async (companyId, receiptId, payload = {}, outerTx = null) => {
  return withTx(async (t) => {
    const receipt = await loadEditableDraftReceipt(companyId, receiptId, t);
    if (!receipt) return null;

    const updates = {};
    if (payload.warehouseId !== undefined) {
      const warehouseId = asOptionalUuid(payload.warehouseId);
      if (!warehouseId) {
        throw new AppError(400, 'warehouseId is required', { code: 'VALIDATION_ERROR' });
      }
      updates.warehouseId = warehouseId;
      if (warehouseId !== asText(receipt.warehouseId)
        && payload.inboundLocationId === undefined
        && payload.locationId === undefined) {
        updates.inboundLocationId = null;
      }
    }
    if (payload.inboundLocationId !== undefined || payload.locationId !== undefined) {
      updates.inboundLocationId = asOptionalUuid(
        payload.inboundLocationId !== undefined ? payload.inboundLocationId : payload.locationId
      );
    }

    if (Object.keys(updates).length) {
      await receipt.update(updates, { transaction: t });
    }

    return module.exports.getById(companyId, receipt.id, { transaction: t });
  }, outerTx);
};

module.exports.addDraftItem = async (companyId, receiptId, payload = {}, outerTx = null) => {
  return withTx(async (t) => {
    const receipt = await loadEditableDraftReceipt(companyId, receiptId, t);
    if (!receipt) return null;

    await ReceiptItem.create(
      {
        receiptId: receipt.id,
        ...buildDraftItemPayload(payload),
      },
      { transaction: t }
    );

    return module.exports.getById(companyId, receipt.id, { transaction: t });
  }, outerTx);
};

module.exports.updateDraftItem = async (companyId, receiptId, itemId, payload = {}, outerTx = null) => {
  return withTx(async (t) => {
    const receipt = await loadEditableDraftReceipt(companyId, receiptId, t);
    if (!receipt) return null;

    const item = await ReceiptItem.findOne({
      where: { id: itemId, receiptId: receipt.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!item) return null;

    await item.update(buildDraftItemPayload(payload, item), { transaction: t });

    return module.exports.getById(companyId, receipt.id, { transaction: t });
  }, outerTx);
};

module.exports.removeDraftItem = async (companyId, receiptId, itemId, outerTx = null) => {
  return withTx(async (t) => {
    const receipt = await loadEditableDraftReceipt(companyId, receiptId, t);
    if (!receipt) return null;

    const item = await ReceiptItem.findOne({
      where: { id: itemId, receiptId: receipt.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!item) return null;

    await item.destroy({ transaction: t });
    return module.exports.getById(companyId, receipt.id, { transaction: t });
  }, outerTx);
};

// K1.3 — createReceiptCorrection (PZK).
//
// Posts a PZK (PZ_KOREKTA) against an already-completed PZ. MVP policy:
//   - quantity-only correction (cannot edit unit cost).
//   - only negative deltas (reduce the original received qty); positive deltas should be a
//     new PZ rather than a correction (see audit §4.1).
//   - hard-reject if a cost layer has been partially consumed by downstream WZ/RW
//     (LAYER_PARTIALLY_CONSUMED, audit §3.4 policy A) — caller must reverse downstream first.
//
// Each correction line produces:
//   - one PZK ReceiptItem
//   - one reverse StockMove (type='ship') that debits qty_on_hand and references the
//     original incoming move via reversesMoveId / refType='PZ_KOREKTA'
//   - a costingService.reverseIncomingLayer call which zeroes the layer and writes a
//     mirrored cost snapshot on the reverse move
//
// The original receipt transitions to status='corrected' with correctedById = PZK id.
//
// Idempotency: callers should not retry blindly — a second call against the same original
// will fail with DOCUMENT_ALREADY_CORRECTED.
module.exports.createReceiptCorrection = async (companyId, receiptId, payload = {}, options = {}) => {
  return withTx(async (t) => {
    if (!companyId) {
      throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
    }
    if (!receiptId) {
      throw new AppError(400, 'receiptId is required', { code: 'VALIDATION_ERROR' });
    }

    // Lock the parent row only; Postgres rejects FOR UPDATE on a LEFT-OUTER-JOIN, so we
    // fetch items separately right after.
    const original = await Receipt.findOne({
      where: { id: receiptId, companyId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!original) {
      throw new AppError(404, 'Receipt not found', { code: 'RECEIPT_NOT_FOUND' });
    }
    original.items = await ReceiptItem.findAll({
      where: { receiptId: original.id },
      transaction: t,
    });

    // A correction of a correction is explicitly disallowed in MVP (audit §4.1).
    if (original.parentDocumentId) {
      throw new AppError(409, 'Cannot correct a correction document', {
        code: 'CORRECTION_OF_CORRECTION_NOT_ALLOWED',
        details: { receiptId, parentDocumentId: original.parentDocumentId },
      });
    }
    if (original.correctedById) {
      throw new AppError(409, 'Document already corrected', {
        code: 'DOCUMENT_ALREADY_CORRECTED',
        details: { receiptId, correctedById: original.correctedById },
      });
    }
    if (!['received', 'putaway'].includes(original.status)) {
      throw new AppError(409, `Receipt must be received/putaway to correct (current: ${original.status})`, {
        code: 'RECEIPT_NOT_CORRECTABLE',
        details: { receiptId, status: original.status },
      });
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) {
      throw new AppError(400, 'At least one correction line is required', {
        code: 'VALIDATION_ERROR',
        details: { receiptId },
      });
    }

    // Validate lines against the original receipt's items + their incoming moves.
    const originalItemsById = new Map((original.items || []).map((row) => [row.id, row]));
    const lineSpecs = [];
    for (const raw of items) {
      const originalItemId = asText(raw.originalItemId);
      if (!originalItemId) {
        throw new AppError(400, 'originalItemId is required on each correction line', { code: 'VALIDATION_ERROR' });
      }
      const originalItem = originalItemsById.get(originalItemId);
      if (!originalItem) {
        throw new AppError(404, 'Original receipt item not found on this receipt', {
          code: 'RECEIPT_ITEM_NOT_FOUND',
          details: { receiptId, originalItemId },
        });
      }
      const correctionQty = toPositiveQty(raw.qty);
      const qtyReceived = asNumber(originalItem.qtyReceived, 0);
      if (round4(correctionQty) > round4(qtyReceived)) {
        throw new AppError(409, 'correction qty cannot exceed originally received qty', {
          code: 'CORRECTION_QTY_EXCEEDS_RECEIVED',
          details: { originalItemId, qtyReceived, correctionQty },
        });
      }

      // Find the original incoming stock move for this receipt line (there should be exactly
      // one for a posted PZ; multiple shouldn't happen in MVP because receiveLine is whole-line).
      const originalMove = await StockMove.findOne({
        where: {
          companyId,
          refType: 'PZ',
          refId: receiptId,
          refItemId: originalItemId,
          type: 'receipt',
        },
        order: [['createdAt', 'ASC']],
        transaction: t,
      });
      if (!originalMove) {
        throw new AppError(409, 'Original incoming stock move not found for this line', {
          code: 'ORIGINAL_STOCK_MOVE_NOT_FOUND',
          details: { receiptId, originalItemId },
        });
      }

      // MVP requires the correction to be full-line for FIFO sanity: a partial-qty PZK would
      // require splitting the layer, which the current schema does not support.
      if (round4(correctionQty) !== round4(asNumber(originalMove.qty, 0))) {
        throw new AppError(409, 'MVP supports only full-quantity PZK lines', {
          code: 'PARTIAL_PZ_CORRECTION_NOT_SUPPORTED',
          details: {
            originalItemId,
            originalMoveQty: asNumber(originalMove.qty, 0),
            correctionQty,
          },
        });
      }

      // Pre-flight: hard-reject if the layer was partially consumed downstream.
      const layer = await CostLayer.findOne({
        where: { sourceMoveId: originalMove.id },
        transaction: t,
      });
      if (!layer) {
        throw new AppError(409, 'Cost layer for original receipt move not found', {
          code: 'COST_LAYER_NOT_FOUND',
          details: { originalMoveId: originalMove.id },
        });
      }
      const qtyIn = round4(asNumber(layer.qtyIn, 0));
      const qtyRemaining = round4(asNumber(layer.qtyRemaining, 0));
      if (qtyRemaining < qtyIn) {
        throw new AppError(409, 'Layer partially consumed downstream — reverse those moves first', {
          code: 'LAYER_PARTIALLY_CONSUMED',
          details: { layerId: layer.id, originalMoveId: originalMove.id, qtyIn, qtyRemaining },
        });
      }

      const locationId = asText(raw.locationId) || originalMove.toLocationId || null;
      lineSpecs.push({ raw, originalItem, originalMove, correctionQty, layer, locationId });
    }

    // Generate the PZK number (PZ_KOREKTA series). issueDate isn't stored on the receipt
    // model (the table only carries timestamps), but the numbering service uses it to pick
    // the year/month bucket for the sequence reset.
    const issueDate = payload.issueDate ? new Date(payload.issueDate) : new Date();
    await assertDocumentTypeEnabled({ companyId, documentType: 'PZ_KOREKTA', transaction: t });
    const number = await generateNextDocumentNumber({
      companyId,
      documentType: 'PZ_KOREKTA',
      issueDate,
      transaction: t,
    });

    // Create the PZK receipt + items, then post each line.
    const pzk = await Receipt.create(
      {
        companyId,
        warehouseId: original.warehouseId,
        number,
        status: 'received', // posted in-line
        parentDocumentId: original.id,
      },
      { transaction: t }
    );

    for (const spec of lineSpecs) {
      const { originalItem, originalMove, correctionQty, locationId } = spec;
      const pzkItem = await ReceiptItem.create(
        {
          receiptId: pzk.id,
          productId: originalItem.productId,
          variantId: originalItem.variantId ?? null,
          qtyExpected: correctionQty,
          qtyReceived: correctionQty,
          unitCost: originalItem.unitCost,
          currency: originalItem.currency,
        },
        { transaction: t }
      );

      // Reverse stock_move: debit qty_on_hand from the location that received the PZ.
      // We use type='ship' so applyMove enforces the INSUFFICIENT_STOCK guard, which gives
      // belt-and-braces protection alongside the layer-level LAYER_PARTIALLY_CONSUMED check.
      const reverseMove = await Inventory.applyMove(
        {
          companyId,
          type: 'ship',
          warehouseId: original.warehouseId,
          fromLocationId: locationId,
          productId: originalItem.productId,
          variantId: originalItem.variantId ?? null,
          qty: correctionQty,
          refType: 'PZ_KOREKTA',
          refId: pzk.id,
          refItemId: pzkItem.id,
        },
        { transaction: t }
      );

      await costingService.reverseIncomingLayer(
        {
          transaction: t,
          originalStockMoveId: originalMove.id,
          reversingStockMoveId: reverseMove.id,
        }
      );
    }

    // Mark the original as corrected.
    await Receipt.update(
      { status: 'corrected', correctedById: pzk.id },
      { where: { id: original.id, companyId }, transaction: t }
    );

    return module.exports.getById(companyId, pzk.id, { transaction: t });
  }, options.transaction || null);
};

// list: возвращает список PZ-документов с фильтрами и пагинацией.
module.exports.list = async (companyId, query = {}, options = {}) => {
  const transaction = options.transaction || null;
  const { page, limit, offset } = parsePaging(query);
  const where = buildListWhere(companyId, query);
  const order = [['createdAt', 'DESC']];

  const { rows, count } = await Receipt.findAndCountAll({
    where,
    order,
    limit,
    offset,
    transaction,
  });

  return { rows, count, page, limit };
};

// getById: возвращает PZ-документ c items.
module.exports.getById = async (companyId, id, options = {}) => {
  const transaction = options.transaction || null;
  if (!id) return null;
  const row = await Receipt.findOne({
    where: { id, companyId },
    include: [
      warehouseInclude,
      inboundLocationInclude,
      {
        model: ReceiptItem,
        as: 'items',
        include: [productInclude, variantInclude],
      },
      {
        model: Receipt,
        as: 'parentDocument',
        attributes: ['id', 'number', 'status'],
      },
      {
        model: Receipt,
        as: 'correctedBy',
        attributes: ['id', 'number', 'status'],
      },
    ],
    order: [[{ model: ReceiptItem, as: 'items' }, 'createdAt', 'ASC']],
    transaction,
  });
  return enrichReceiptDto(row);
};

// listStockMoves: возвращает историю движений по PZ-документу.
module.exports.listStockMoves = async (companyId, receiptId, query = {}, options = {}) => {
  const transaction = options.transaction || null;
  if (!receiptId) return { rows: [], count: 0, page: 1, limit: 20 };
  const receipt = await Receipt.findOne({
    where: { id: receiptId, companyId },
    attributes: ['id', 'parentDocumentId'],
    transaction,
  });
  if (!receipt) return null;

  const { page, limit, offset } = parsePaging(query);
  const where = {
    companyId,
    refType: receipt.parentDocumentId ? 'PZ_KOREKTA' : 'PZ',
    refId: receiptId,
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

// listItemStockMoves: возвращает историю движений по строке PZ через refItemId.
module.exports.listItemStockMoves = async (companyId, receiptItemId, query = {}, options = {}) => {
  const transaction = options.transaction || null;
  if (!receiptItemId) return { rows: [], count: 0, page: 1, limit: 20 };
  const item = await ReceiptItem.findOne({
    where: { id: receiptItemId },
    include: [{ model: Receipt, as: 'receipt', attributes: ['id', 'companyId', 'parentDocumentId'] }],
    transaction,
  });
  if (!item || !item.receipt || item.receipt.companyId !== companyId) return null;

  const { page, limit, offset } = parsePaging(query);
  const where = {
    companyId,
    refType: item.receipt.parentDocumentId ? 'PZ_KOREKTA' : 'PZ',
    refId: item.receiptId,
    refItemId: item.id,
  };

  const rows = await StockMove.findAll({
    where,
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
        refType: 'PZ',
        refId: item.receiptId,
        refItemId: null,
        productId: item.productId,
        variantId: item.variantId ?? null,
        type: 'receipt',
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
