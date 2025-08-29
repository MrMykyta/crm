
// shipmentService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { Shipment, ShipmentItem } = require('../../models');

module.exports.create = async (companyId, data, outerTx=null) => {
  return await withTx(async (t) => {
    const { items=[], ...core } = data;
    const ship = await Shipment.create({ ...core, companyId, status:'open' }, { transaction:t });
    if (items.length) {
      await ShipmentItem.bulkCreate(items.map(i=>({ ...i, companyId, shipmentId: ship.id })), { transaction:t });
    }
    return ship;
  }, outerTx);
};

module.exports.shipItem = async (companyId, shipmentItemId, { qty, fromLocationId, lotId=null }, outerTx=null) => {
  return await withTx(async (t) => {
    const item = await ShipmentItem.findOne({ where:{ companyId, id: shipmentItemId }, transaction:t });
    if (!item) return null;
    await Inventory.applyMove(companyId, {
      warehouseId: item.warehouseId, productId: item.productId, variantId: item.variantId,
      qty, fromLocationId, lotId, reason:'shipment'
    }, t);
    const shippedQty = (item.shippedQty || 0) + qty;
    await item.update({ shippedQty }, { transaction:t });
    return item;
  }, outerTx);
};
