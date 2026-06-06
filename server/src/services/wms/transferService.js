'use strict';

const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const Inventory = require('./inventoryService');
const costingService = require('./costingService');
const { resolveDefaultWarehouseId } = require('./warehouseResolver');
const { TransferOrder, TransferItem, StockMove } = require('../../models');
const { assertDocumentTypeEnabled, generateNextDocumentNumber } = require('../crm/documentNumberingService');

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

// create: создаёт новую запись и возвращает результат.
module.exports.create = async (companyId, data, outerTx = null) => {
  return withTx(async (t) => {
    const { items = [], ...core } = data || {};
    const needsDefault = !core.fromWarehouseId || !core.toWarehouseId;
    const defaultWarehouseId = needsDefault
      ? await resolveDefaultWarehouseId(companyId, { transaction: t })
      : null;
    const fromWarehouseId = core.fromWarehouseId || defaultWarehouseId;
    const toWarehouseId = core.toWarehouseId || defaultWarehouseId;
    const manualNumber = asText(core.number);
    await assertDocumentTypeEnabled({
      companyId,
      documentType: 'MM',
      transaction: t,
    });
    const generatedNumber = manualNumber
      ? null
      : await generateNextDocumentNumber({
        companyId,
        documentType: 'MM',
        issueDate: core.issueDate || new Date(),
        transaction: t,
      });

    const order = await TransferOrder.create(
      {
        ...core,
        companyId,
        fromWarehouseId,
        toWarehouseId,
        number: manualNumber || generatedNumber,
        status: core.status || 'draft',
      },
      { transaction: t }
    );

    if (Array.isArray(items) && items.length) {
      await TransferItem.bulkCreate(
        items.map((item) => ({
          ...item,
          transferId: order.id,
          movedQty: asNumber(item.movedQty, 0),
        })),
        { transaction: t }
      );
    }

    return order;
  }, outerTx);
};

// executeLine: выполняет вспомогательную бизнес-логику сервиса.
module.exports.executeLine = async (
  companyId,
  transferItemId,
  { fromLocationId, toLocationId, qty },
  outerTx = null
) => {
  return withTx(async (t) => {
    const moveQty = toPositiveQty(qty);
    const item = await TransferItem.findOne({
      where: { id: transferItemId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!item) return null;

    const transfer = await TransferOrder.findOne({
      where: { id: item.transferId, companyId },
      attributes: ['id', 'companyId', 'fromWarehouseId', 'toWarehouseId'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!transfer) return null;

    const plannedQty = asNumber(item.qty, 0);
    const movedQty = asNumber(item.movedQty, 0);
    const isClosed = movedQty >= plannedQty;
    if (isClosed) {
      const existingMoveCountByLine = await StockMove.count({
        where: {
          companyId,
          refType: 'MM',
          refId: item.transferId,
          refItemId: item.id,
          type: 'transfer',
        },
        transaction: t,
      });
      if (existingMoveCountByLine >= 2) {
        return item.reload({ transaction: t });
      }

      // Backward-compatibility for historical stock_moves created before ref_item_id.
      const existingMoveCountLegacy = await StockMove.count({
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
        transaction: t,
      });
      if (existingMoveCountLegacy >= 2) {
        return item.reload({ transaction: t });
      }
      throw new AppError(409, 'Transfer item already fully executed', {
        code: 'TRANSFER_ITEM_ALREADY_EXECUTED',
      });
    }

    const nextMovedQty = round4(movedQty + moveQty);
    if (nextMovedQty > round4(plannedQty)) {
      throw new AppError(409, 'movedQty cannot exceed planned qty', {
        code: 'QTY_EXCEEDS_PLANNED',
        details: {
          plannedQty,
          movedQty,
          requestedQty: moveQty,
        },
      });
    }

    const outMove = await Inventory.applyMove(
      {
        companyId,
        type: 'transfer',
        warehouseId: transfer.fromWarehouseId,
        fromLocationId,
        productId: item.productId,
        variantId: item.variantId,
        lotId: item.lotId,
        qty: moveQty,
        refType: 'MM',
        refId: item.transferId,
        refItemId: item.id,
      },
      { transaction: t }
    );
    const inMove = await Inventory.applyMove(
      {
        companyId,
        type: 'transfer',
        warehouseId: transfer.toWarehouseId,
        toLocationId,
        productId: item.productId,
        variantId: item.variantId,
        lotId: item.lotId,
        qty: moveQty,
        refType: 'MM',
        refId: item.transferId,
        refItemId: item.id,
      },
      { transaction: t }
    );

    // FIFO transfer: consume source layers and split-create target layers preserving each source
    // unit_cost (per G1.2b). assertCostingInitialized is enforced inside transferFifoLayers.
    await costingService.transferFifoLayers(outMove, inMove, t);

    await item.update({ movedQty: nextMovedQty }, { transaction: t });
    return item.reload({ transaction: t });
  }, outerTx);
};
