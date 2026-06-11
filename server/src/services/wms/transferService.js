'use strict';

const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const Inventory = require('./inventoryService');
const costingService = require('./costingService');
const { resolveDefaultWarehouseId } = require('./warehouseResolver');
const { TransferOrder, TransferItem, StockMove, Location } = require('../../models');
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

// Validate that a (nullable) location belongs to the company and, when the location
// row carries a warehouseId, to the expected warehouse. NO-OP for null locationId.
async function assertLocationBelongs(companyId, locationId, expectedWarehouseId, field, transaction) {
  if (!locationId) return;
  const location = await Location.findOne({
    where: { id: locationId, companyId },
    attributes: ['id', 'warehouseId'],
    transaction,
  });
  if (!location) {
    throw new AppError(400, 'Location not found in current company', {
      code: 'TRANSFER_LOCATION_INVALID',
      details: { field, locationId },
    });
  }
  if (expectedWarehouseId && location.warehouseId && asText(location.warehouseId) !== asText(expectedWarehouseId)) {
    throw new AppError(400, 'Location does not belong to the expected warehouse', {
      code: 'TRANSFER_LOCATION_WAREHOUSE_MISMATCH',
      details: { field, locationId, expectedWarehouseId },
    });
  }
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

    // Document-level default locations (MVP). Validate company + warehouse membership.
    const sourceLocationId = asText(core.sourceLocationId) || null;
    const targetLocationId = asText(core.targetLocationId) || null;
    await assertLocationBelongs(companyId, sourceLocationId, fromWarehouseId, 'sourceLocationId', t);
    await assertLocationBelongs(companyId, targetLocationId, toWarehouseId, 'targetLocationId', t);

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
        sourceLocationId,
        targetLocationId,
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
      attributes: ['id', 'companyId', 'fromWarehouseId', 'toWarehouseId', 'sourceLocationId', 'targetLocationId', 'status'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!transfer) return null;
    if (!['draft', 'in_transit'].includes(transfer.status)) {
      throw new AppError(409, 'Transfer must be draft or in_transit to execute', {
        code: 'TRANSFER_NOT_EXECUTABLE',
        details: { transferId: transfer.id, status: transfer.status },
      });
    }
    // Use explicit payload locations when present; otherwise fall back to the document's
    // default source/target locations.
    const effectiveFromLocationId = asText(fromLocationId) || asText(transfer.sourceLocationId) || null;
    const effectiveToLocationId = asText(toLocationId) || asText(transfer.targetLocationId) || null;

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
        fromLocationId: effectiveFromLocationId || null,
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
        toLocationId: effectiveToLocationId || null,
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
    const allItems = await TransferItem.findAll({
      where: { transferId: item.transferId },
      attributes: ['id', 'qty', 'movedQty'],
      transaction: t,
    });
    const allReceived = allItems.every((row) => {
      const rowMovedQty = row.id === item.id ? nextMovedQty : asNumber(row.movedQty, 0);
      return round4(rowMovedQty) >= round4(asNumber(row.qty, 0));
    });
    const nextStatus = allReceived ? 'received' : 'in_transit';
    if (transfer.status !== nextStatus) {
      await transfer.update({ status: nextStatus }, { transaction: t });
    }
    return item.reload({ transaction: t });
  }, outerTx);
};
