
// adjustmentService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { Adjustment, AdjustmentItem } = require('../../models');

module.exports.create = async (companyId, data, outerTx=null) => {
  return await withTx(async (t) => {
    const { items=[], ...core } = data;
    const adj = await Adjustment.create({ ...core, companyId, status:'open' }, { transaction:t });
    for (const it of items) {
      await AdjustmentItem.create({ ...it, companyId, adjustmentId: adj.id }, { transaction:t });
      if (it.qtyDiff !== 0) {
        await Inventory.applyMove(companyId, {
          warehouseId: core.warehouseId, productId: it.productId, variantId: it.variantId,
          qty: Math.abs(it.qtyDiff),
          fromLocationId: it.qtyDiff < 0 ? it.locationId : null,
          toLocationId:   it.qtyDiff > 0 ? it.locationId : null,
          lotId: it.lotId, reason:'adjustment'
        }, t);
      }
    }
    await adj.update({ status:'done' }, { transaction:t });
    return adj;
  }, outerTx);
};
