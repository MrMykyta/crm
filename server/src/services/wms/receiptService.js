'use strict';

const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { Receipt, ReceiptItem } = require('../../models');
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
    const issueDate = core.issueDate || new Date();
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

    return Receipt.findOne({
      where: { id: receipt.id, companyId },
      include: [{ model: ReceiptItem, as: 'items' }],
      transaction: t,
    });
  }, outerTx);
};

// receiveLine: выполняет вспомогательную бизнес-логику сервиса.
module.exports.receiveLine = async (companyId, receiptItemId, { qty, toLocationId, lotId = null }, outerTx = null) => {
  return withTx(async (t) => {
    const item = await ReceiptItem.findOne({
      where: { id: receiptItemId },
      include: [{ model: Receipt, as: 'receipt', attributes: ['id', 'companyId', 'warehouseId'] }],
      transaction: t,
    });
    if (!item || !item.receipt || item.receipt.companyId !== companyId) return null;

    await Inventory.applyMove(
      companyId,
      {
        warehouseId: item.receipt.warehouseId,
        productId: item.productId,
        variantId: item.variantId,
        qty,
        toLocationId,
        lotId,
        reason: 'receipt',
      },
      t
    );

    const receivedQty = asNumber(item.qtyReceived, 0) + asNumber(qty, 0);
    await item.update({ qtyReceived: receivedQty }, { transaction: t });

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

    return item;
  }, outerTx);
};
