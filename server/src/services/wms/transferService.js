
// transferService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { TransferOrder, TransferItem } = require('../../models');

module.exports.create = async (companyId, data, outerTx=null) => {
  return await withTx(async (t) => {
    const { items=[], ...core } = data;
    const order = await TransferOrder.create({ ...core, companyId, status:'open' }, { transaction:t });
    if (items.length) {
      await TransferItem.bulkCreate(items.map(i=>({ ...i, companyId, transferOrderId: order.id })), { transaction:t });
    }
    return order;
  }, outerTx);
};

module.exports.executeLine = async (companyId, transferItemId, { fromLocationId, toLocationId, qty }, outerTx=null) => {
  return await withTx(async (t) => {
    const item = await TransferItem.findOne({ where:{ companyId, id: transferItemId }, transaction:t });
    if (!item) return null;
    await Inventory.applyMove(companyId, {
      warehouseId: item.fromWarehouseId, productId: item.productId, variantId: item.variantId,
      qty, fromLocationId, reason:'transfer-out'
    }, t);
    await Inventory.applyMove(companyId, {
      warehouseId: item.toWarehouseId, productId: item.productId, variantId: item.variantId,
      qty, toLocationId, reason:'transfer-in'
    }, t);
    const moved = (item.movedQty || 0) + qty;
    await item.update({ movedQty: moved }, { transaction:t });
    return item;
  }, outerTx);
};
