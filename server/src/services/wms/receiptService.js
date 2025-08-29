
// receiptService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { Receipt, ReceiptItem } = require('../../models');

module.exports.create = async (companyId, data, outerTx=null) => {
  return await withTx(async (t) => {
    const { items=[], ...core } = data;
    const receipt = await Receipt.create({ ...core, companyId, status:'open' }, { transaction:t });
    if (items.length) {
      await ReceiptItem.bulkCreate(items.map(i=>({ ...i, companyId, receiptId: receipt.id, receivedQty:0 })), { transaction:t });
    }
    return await Receipt.findOne({ where:{ id: receipt.id, companyId }, include:[{ model: ReceiptItem, as:'items' }], transaction:t });
  }, outerTx);
};

module.exports.receiveLine = async (companyId, receiptItemId, { qty, toLocationId, lotId=null }, outerTx=null) => {
  return await withTx(async (t) => {
    const item = await ReceiptItem.findOne({ where:{ companyId, id: receiptItemId }, transaction:t });
    if (!item) return null;
    await Inventory.applyMove(companyId, {
      warehouseId: item.warehouseId, productId: item.productId, variantId: item.variantId,
      qty, toLocationId, lotId, reason:'receipt'
    }, t);
    await item.update({ receivedQty: item.receivedQty + qty }, { transaction:t });
    const all = await ReceiptItem.findAll({ where:{ companyId, receiptId: item.receiptId }, transaction:t });
    const done = all.every(i => i.qty <= i.receivedQty);
    if (done) await Receipt.update({ status:'received' }, { where:{ companyId, id: item.receiptId }, transaction:t });
    return item;
  }, outerTx);
};
