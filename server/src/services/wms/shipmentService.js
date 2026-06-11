'use strict';

const { Op } = require('sequelize');
const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const Inventory = require('./inventoryService');
const costingService = require('./costingService');
const { resolveDefaultWarehouseId } = require('./warehouseResolver');
const { Shipment, ShipmentItem, StockMove } = require('../../models');
const { assertDocumentTypeEnabled, generateNextDocumentNumber } = require('../crm/documentNumberingService');
const {
  enrichShipmentDto,
  enrichStockMoveRows,
  orderInclude,
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

function parsePaging(query = {}) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
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

async function getShippedQtyForItem({ companyId, shipmentId, shipmentItemId, transaction }) {
  const moved = await StockMove.sum('qty', {
    where: {
      companyId,
      refType: 'WZ',
      refId: shipmentId,
      refItemId: shipmentItemId,
      type: 'ship',
    },
    transaction,
  });
  return round4(asNumber(moved, 0));
}

// create: создаёт WZ-документ и позиции.
module.exports.create = async (companyId, data, outerTx = null) => {
  return withTx(async (t) => {
    const { items = [], ...core } = data || {};

    const warehouseId = core.warehouseId || (await resolveDefaultWarehouseId(companyId, { transaction: t }));
    const manualNumber = asText(core.number);

    await assertDocumentTypeEnabled({
      companyId,
      documentType: 'WZ',
      transaction: t,
    });

    if (manualNumber) {
      const duplicate = await Shipment.findOne({
        where: { companyId, number: manualNumber },
        attributes: ['id'],
        transaction: t,
      });
      if (duplicate) {
        throw new AppError(409, 'Shipment number already exists', {
          code: 'SHIPMENT_NUMBER_DUPLICATE',
        });
      }
    }

    const generatedNumber = manualNumber
      ? null
      : await generateNextDocumentNumber({
        companyId,
        documentType: 'WZ',
        issueDate: core.issueDate || new Date(),
        transaction: t,
      });

    const shipment = await Shipment.create(
      {
        ...core,
        companyId,
        warehouseId,
        number: manualNumber || generatedNumber,
        status: core.status || 'packing',
      },
      { transaction: t }
    );

    if (Array.isArray(items) && items.length) {
      await ShipmentItem.bulkCreate(
        items.map((item) => ({
          ...item,
          shipmentId: shipment.id,
          qty: toPositiveQty(item.qty),
        })),
        { transaction: t }
      );
    }

    return module.exports.getById(companyId, shipment.id, { transaction: t });
  }, outerTx);
};

// shipItem: списывает строку WZ через inventoryService.applyMove c идемпотентностью по refItemId.
module.exports.shipItem = async (
  companyId,
  shipmentItemId,
  { qty, fromLocationId, lotId = null, serialId = null },
  outerTx = null
) => {
  return withTx(async (t) => {
    const moveQty = toPositiveQty(qty);

    const item = await ShipmentItem.findOne({
      where: { id: shipmentItemId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!item) return null;

    const shipment = await Shipment.findOne({
      where: { id: item.shipmentId, companyId },
      attributes: ['id', 'companyId', 'warehouseId', 'status', 'parentDocumentId'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!shipment) return null;
    if (shipment.parentDocumentId) {
      throw new AppError(409, 'Correction shipment documents are immutable', {
        code: 'CORRECTION_DOCUMENT_IMMUTABLE',
        details: { shipmentId: shipment.id, parentDocumentId: shipment.parentDocumentId },
      });
    }
    if (shipment.status !== 'packing') {
      throw new AppError(409, 'Shipment must be packing to ship', {
        code: 'SHIPMENT_NOT_PACKING',
        details: { shipmentId: shipment.id, status: shipment.status },
      });
    }

    const plannedQty = round4(asNumber(item.qty, 0));
    const shippedQty = await getShippedQtyForItem({
      companyId,
      shipmentId: item.shipmentId,
      shipmentItemId: item.id,
      transaction: t,
    });

    if (shippedQty >= plannedQty) {
      return item.reload({ transaction: t });
    }

    const nextShippedQty = round4(shippedQty + moveQty);
    if (nextShippedQty > plannedQty) {
      throw new AppError(409, 'shipped qty cannot exceed planned qty', {
        code: 'QTY_EXCEEDS_PLANNED',
        details: {
          plannedQty,
          shippedQty,
          requestedQty: moveQty,
        },
      });
    }

    const move = await Inventory.applyMove(
      {
        companyId,
        type: 'ship',
        warehouseId: shipment.warehouseId,
        fromLocationId: asText(fromLocationId) || null,
        productId: item.productId,
        variantId: item.variantId,
        lotId,
        serialId,
        qty: moveQty,
        refType: 'WZ',
        refId: item.shipmentId,
        refItemId: item.id,
      },
      { transaction: t }
    );

    // FIFO COGS: consumes cost layers and writes unit_cost/total_cost/cost_method on the WZ stock_move.
    // The init gate (assertCostingInitialized) is enforced inside consumeFifoLayers.
    await costingService.applyCostingForMove(move, {}, t);

    const allItems = await ShipmentItem.findAll({
      where: { shipmentId: item.shipmentId },
      attributes: ['id', 'qty'],
      transaction: t,
    });

    const lineIds = allItems.map((row) => row.id);
    const movedByLine = lineIds.length
      ? await StockMove.findAll({
        where: {
          companyId,
          refType: 'WZ',
          refId: item.shipmentId,
          type: 'ship',
          refItemId: { [Op.in]: lineIds },
        },
        attributes: ['refItemId', 'qty'],
        transaction: t,
      })
      : [];

    const qtyByItem = new Map();
    movedByLine.forEach((row) => {
      const key = row.refItemId;
      const curr = asNumber(qtyByItem.get(key), 0);
      qtyByItem.set(key, round4(curr + asNumber(row.qty, 0)));
    });

    const isDone = allItems.every((row) => {
      const moved = asNumber(qtyByItem.get(row.id), 0);
      return round4(moved) >= round4(asNumber(row.qty, 0));
    });

    if (isDone && shipment.status !== 'shipped') {
      await shipment.update({ status: 'shipped' }, { transaction: t });
    }

    return item.reload({ transaction: t });
  }, outerTx);
};

// K1.3 — createShipmentCorrection (WZK).
//
// Posts a WZK (WZ_KOREKTA) against an already-shipped WZ. MVP policy:
//   - quantity correction only: WZK adds qty back to stock (partial or full return).
//   - qty per line ≤ original shipped qty.
//   - no "correction of correction": parentDocumentId on the original must be NULL.
//   - no double-correct: original.correctedById must be NULL.
//
// Each correction line produces:
//   - one WZK ShipmentItem
//   - one reverse StockMove (type='receipt') that credits qty_on_hand back to the source
//     location and references the original outgoing move via refType='WZ_KOREKTA'
//   - a costingService.reverseConsumption call which restores layer.qty_remaining and
//     soft-marks the original allocation rows as reversed
//
// The original shipment transitions to status='corrected' with correctedById = WZK id.
module.exports.createShipmentCorrection = async (companyId, shipmentId, payload = {}, options = {}) => {
  return withTx(async (t) => {
    if (!companyId) {
      throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
    }
    if (!shipmentId) {
      throw new AppError(400, 'shipmentId is required', { code: 'VALIDATION_ERROR' });
    }

    // Lock the parent row only; Postgres rejects FOR UPDATE on a LEFT-OUTER-JOIN, so we
    // fetch items separately right after.
    const original = await Shipment.findOne({
      where: { id: shipmentId, companyId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!original) {
      throw new AppError(404, 'Shipment not found', { code: 'SHIPMENT_NOT_FOUND' });
    }
    original.items = await ShipmentItem.findAll({
      where: { shipmentId: original.id },
      transaction: t,
    });

    if (original.parentDocumentId) {
      throw new AppError(409, 'Cannot correct a correction document', {
        code: 'CORRECTION_OF_CORRECTION_NOT_ALLOWED',
        details: { shipmentId, parentDocumentId: original.parentDocumentId },
      });
    }
    if (original.correctedById) {
      throw new AppError(409, 'Document already corrected', {
        code: 'DOCUMENT_ALREADY_CORRECTED',
        details: { shipmentId, correctedById: original.correctedById },
      });
    }
    if (original.status !== 'shipped') {
      throw new AppError(409, `Shipment must be shipped to correct (current: ${original.status})`, {
        code: 'SHIPMENT_NOT_SHIPPED',
        details: { shipmentId, status: original.status },
      });
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) {
      throw new AppError(400, 'At least one correction line is required', {
        code: 'VALIDATION_ERROR',
        details: { shipmentId },
      });
    }

    const originalItemsById = new Map((original.items || []).map((row) => [row.id, row]));
    const lineSpecs = [];
    for (const raw of items) {
      const originalItemId = asText(raw.originalItemId);
      if (!originalItemId) {
        throw new AppError(400, 'originalItemId is required on each correction line', { code: 'VALIDATION_ERROR' });
      }
      const originalItem = originalItemsById.get(originalItemId);
      if (!originalItem) {
        throw new AppError(404, 'Original shipment item not found on this shipment', {
          code: 'SHIPMENT_ITEM_NOT_FOUND',
          details: { shipmentId, originalItemId },
        });
      }

      const correctionQty = toPositiveQty(raw.qty);
      const shippedQty = await getShippedQtyForItem({
        companyId,
        shipmentId,
        shipmentItemId: originalItemId,
        transaction: t,
      });
      if (round4(correctionQty) > round4(shippedQty)) {
        throw new AppError(409, 'correction qty cannot exceed originally shipped qty', {
          code: 'CORRECTION_QTY_EXCEEDS_SHIPPED',
          details: { originalItemId, shippedQty, correctionQty },
        });
      }

      // Find the original outgoing move(s) for this line. MVP expects exactly one (shipItem
      // posts the whole line at once); but in case there are multiple we lock all of them and
      // require the correction to match one of them in full.
      const originalMoves = await StockMove.findAll({
        where: {
          companyId,
          refType: 'WZ',
          refId: shipmentId,
          refItemId: originalItemId,
          type: 'ship',
        },
        order: [['createdAt', 'ASC']],
        transaction: t,
      });
      if (originalMoves.length === 0) {
        throw new AppError(409, 'Original outgoing stock move not found for this line', {
          code: 'ORIGINAL_STOCK_MOVE_NOT_FOUND',
          details: { shipmentId, originalItemId },
        });
      }
      // Sum of original move qtys must be ≥ correctionQty.
      const totalShippedFromMoves = round4(
        originalMoves.reduce((sum, m) => sum + asNumber(m.qty, 0), 0)
      );
      if (round4(correctionQty) > totalShippedFromMoves) {
        throw new AppError(409, 'correction qty exceeds sum of original outgoing moves', {
          code: 'CORRECTION_QTY_EXCEEDS_MOVES',
          details: { originalItemId, totalShippedFromMoves, correctionQty },
        });
      }
      // MVP: full-line correction only (single original move, full qty). Per audit §3.5 the
      // line is the unit of correction — partial reverse-by-quantity inside a single move
      // requires per-allocation accounting we don't ship in MVP.
      if (originalMoves.length !== 1
        || round4(correctionQty) !== round4(asNumber(originalMoves[0].qty, 0))
      ) {
        throw new AppError(409, 'MVP supports only full-line WZK corrections (one move, full qty)', {
          code: 'PARTIAL_WZ_CORRECTION_NOT_SUPPORTED',
          details: {
            originalItemId,
            moves: originalMoves.length,
            correctionQty,
            totalShippedFromMoves,
          },
        });
      }

      const originalMove = originalMoves[0];
      const locationId = asText(raw.locationId) || originalMove.fromLocationId || null;
      lineSpecs.push({ raw, originalItem, originalMove, correctionQty, locationId });
    }

    const issueDate = payload.issueDate ? new Date(payload.issueDate) : new Date();
    await assertDocumentTypeEnabled({ companyId, documentType: 'WZ_KOREKTA', transaction: t });
    const number = await generateNextDocumentNumber({
      companyId,
      documentType: 'WZ_KOREKTA',
      issueDate,
      transaction: t,
    });

    const wzk = await Shipment.create(
      {
        companyId,
        warehouseId: original.warehouseId,
        orderId: original.orderId || null,
        number,
        status: 'shipped', // posted in-line
        parentDocumentId: original.id,
      },
      { transaction: t }
    );

    for (const spec of lineSpecs) {
      const { originalItem, originalMove, correctionQty, locationId } = spec;
      const wzkItem = await ShipmentItem.create(
        {
          shipmentId: wzk.id,
          productId: originalItem.productId,
          variantId: originalItem.variantId ?? null,
          qty: correctionQty,
        },
        { transaction: t }
      );

      // Reverse stock_move: credit qty_on_hand back to the location the WZ shipped from.
      // We use type='receipt' to mirror the natural direction of a stock return.
      const reverseMove = await Inventory.applyMove(
        {
          companyId,
          type: 'receipt',
          warehouseId: original.warehouseId,
          toLocationId: locationId,
          productId: originalItem.productId,
          variantId: originalItem.variantId ?? null,
          qty: correctionQty,
          refType: 'WZ_KOREKTA',
          refId: wzk.id,
          refItemId: wzkItem.id,
        },
        { transaction: t }
      );

      await costingService.reverseConsumption({
        transaction: t,
        originalStockMoveId: originalMove.id,
        reversingStockMoveId: reverseMove.id,
      });
    }

    await Shipment.update(
      { status: 'corrected', correctedById: wzk.id },
      { where: { id: original.id, companyId }, transaction: t }
    );

    return module.exports.getById(companyId, wzk.id, { transaction: t });
  }, options.transaction || null);
};

// list: возвращает список WZ-документов с фильтрами и пагинацией.
module.exports.list = async (companyId, query = {}, options = {}) => {
  const transaction = options.transaction || null;
  const { page, limit, offset } = parsePaging(query);
  const where = buildListWhere(companyId, query);

  const { rows, count } = await Shipment.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    transaction,
  });

  return { rows, count, page, limit };
};

// getById: возвращает WZ-документ с items.
module.exports.getById = async (companyId, id, options = {}) => {
  const transaction = options.transaction || null;
  if (!id) return null;
  const row = await Shipment.findOne({
    where: { id, companyId },
    include: [
      warehouseInclude,
      orderInclude,
      { model: ShipmentItem, as: 'items', include: [productInclude, variantInclude] },
      {
        model: Shipment,
        as: 'parentDocument',
        attributes: ['id', 'number', 'status'],
      },
      {
        model: Shipment,
        as: 'correctedBy',
        attributes: ['id', 'number', 'status'],
      },
    ],
    order: [[{ model: ShipmentItem, as: 'items' }, 'createdAt', 'ASC']],
    transaction,
  });
  return enrichShipmentDto(row);
};

// listStockMoves: возвращает историю движений по WZ-документу.
module.exports.listStockMoves = async (companyId, shipmentId, query = {}, options = {}) => {
  const transaction = options.transaction || null;
  if (!shipmentId) return { rows: [], count: 0, page: 1, limit: 20 };

  const shipment = await Shipment.findOne({
    where: { id: shipmentId, companyId },
    attributes: ['id', 'parentDocumentId'],
    transaction,
  });
  if (!shipment) return null;

  const { page, limit, offset } = parsePaging(query);
  const where = {
    companyId,
    refType: shipment.parentDocumentId ? 'WZ_KOREKTA' : 'WZ',
    refId: shipmentId,
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

// listItemStockMoves: возвращает историю движений по строке WZ через refItemId.
module.exports.listItemStockMoves = async (companyId, shipmentItemId, query = {}, options = {}) => {
  const transaction = options.transaction || null;
  if (!shipmentItemId) return { rows: [], count: 0, page: 1, limit: 20 };

  const item = await ShipmentItem.findOne({
    where: { id: shipmentItemId },
    attributes: ['id', 'shipmentId', 'productId', 'variantId'],
    transaction,
  });
  if (!item) return null;

  const shipment = await Shipment.findOne({
    where: { id: item.shipmentId, companyId },
    attributes: ['id', 'parentDocumentId'],
    transaction,
  });
  if (!shipment) return null;

  const { page, limit, offset } = parsePaging(query);

  const rows = await StockMove.findAll({
    where: {
      companyId,
      refType: shipment.parentDocumentId ? 'WZ_KOREKTA' : 'WZ',
      refId: item.shipmentId,
      refItemId: item.id,
    },
    include: stockMoveIncludes,
    order: [['createdAt', 'ASC']],
    limit,
    offset,
    transaction,
  });

  // legacy fallback for historical rows without ref_item_id.
  let mergedRows = rows;
  if (!rows.length) {
    const legacyRows = await StockMove.findAll({
      where: {
        companyId,
        refType: 'WZ',
        refId: item.shipmentId,
        refItemId: null,
        productId: item.productId,
        variantId: item.variantId ?? null,
        type: 'ship',
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
