'use strict';

const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { TransferOrder, TransferItem } = require('../../models');
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

// create: создаёт новую запись и возвращает результат.
module.exports.create = async (companyId, data, outerTx = null) => {
  return withTx(async (t) => {
    const { items = [], ...core } = data || {};
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
    const item = await TransferItem.findOne({
      where: { id: transferItemId },
      include: [{ model: TransferOrder, as: 'transfer', attributes: ['id', 'companyId', 'fromWarehouseId', 'toWarehouseId'] }],
      transaction: t,
    });
    if (!item || !item.transfer || item.transfer.companyId !== companyId) return null;

    await Inventory.applyMove(
      companyId,
      {
        warehouseId: item.transfer.fromWarehouseId,
        productId: item.productId,
        variantId: item.variantId,
        qty,
        fromLocationId,
        reason: 'transfer-out',
      },
      t
    );
    await Inventory.applyMove(
      companyId,
      {
        warehouseId: item.transfer.toWarehouseId,
        productId: item.productId,
        variantId: item.variantId,
        qty,
        toLocationId,
        reason: 'transfer-in',
      },
      t
    );

    const movedQty = asNumber(item.movedQty, 0) + asNumber(qty, 0);
    await item.update({ movedQty }, { transaction: t });
    return item;
  }, outerTx);
};
