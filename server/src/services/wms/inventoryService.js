
// inventoryService.js (generated)
const { withTx } = require('../../utils/tx');
const { withCompany } = require('../../utils/withCompany');
const { sequelize, InventoryItem, Reservation, StockMove } = require('../../models');

module.exports.getOnHand = async (companyId, { warehouseId, productId, variantId, locationId=null, lotId=null }) => {
  const where = { companyId, warehouseId, productId, variantId };
  if (locationId) where.locationId = locationId;
  if (lotId) where.lotId = lotId;
  const rows = await InventoryItem.findAll({ where });
  const onHand = rows.reduce((s,r)=> s + (r.qty - r.reservedQty), 0);
  return { onHand, rows };
};

module.exports.reserve = async (companyId, { warehouseId, productId, variantId, qty, orderRef }, outerTx=null) => {
  return await withTx(async (t) => {
    const items = await InventoryItem.findAll({ where:{ companyId, warehouseId, productId, variantId }, transaction:t, lock:t.LOCK.UPDATE });
    let need = qty; const created = [];
    for (const inv of items) {
      const free = inv.qty - inv.reservedQty;
      if (free <= 0) continue;
      const take = Math.min(free, need);
      await inv.update({ reservedQty: inv.reservedQty + take }, { transaction:t });
      const r = await Reservation.create({ companyId, warehouseId, productId, variantId, inventoryItemId: inv.id, qty: take, orderRef, status:'reserved' }, { transaction:t });
      created.push(r);
      need -= take; if (need <= 0) break;
    }
    if (need > 0) throw new Error('Not enough stock to reserve');
    return created;
  }, outerTx);
};

module.exports.releaseReservation = async (companyId, reservationId, outerTx=null) => {
  return await withTx(async (t) => {
    const r = await Reservation.findOne({ where:{ companyId, id: reservationId }, transaction:t });
    if (!r) return null;
    const inv = await InventoryItem.findOne({ where:{ companyId, id: r.inventoryItemId }, transaction:t, lock:t.LOCK.UPDATE });
    if (inv) await inv.update({ reservedQty: Math.max(0, inv.reservedQty - r.qty) }, { transaction:t });
    await r.update({ status:'released' }, { transaction:t });
    return r;
  }, outerTx);
};

module.exports.applyMove = async (companyId, { warehouseId, productId, variantId, qty, fromLocationId=null, toLocationId=null, lotId=null, reason='move' }, outerTx=null) => {
  return await withTx(async (t) => {
    if (fromLocationId) {
      const from = await InventoryItem.findOrCreate({
        where:{ companyId, warehouseId, productId, variantId, locationId: fromLocationId, lotId },
        defaults:{ companyId, warehouseId, productId, variantId, locationId: fromLocationId, lotId, qty:0, reservedQty:0 },
        transaction:t, lock:t.LOCK.UPDATE
      }).then(([r])=>r);
      if (from.qty - from.reservedQty < qty) throw new Error('Insufficient stock at source');
      await from.update({ qty: from.qty - qty }, { transaction:t });
    }
    if (toLocationId) {
      const to = await InventoryItem.findOrCreate({
        where:{ companyId, warehouseId, productId, variantId, locationId: toLocationId, lotId },
        defaults:{ companyId, warehouseId, productId, variantId, locationId: toLocationId, lotId, qty:0, reservedQty:0 },
        transaction:t, lock:t.LOCK.UPDATE
      }).then(([r])=>r);
      await to.update({ qty: to.qty + qty }, { transaction:t });
    }
    return await StockMove.create({ companyId, warehouseId, productId, variantId, qty, fromLocationId, toLocationId, lotId, reason, status:'done' }, { transaction:t });
  }, outerTx);
};
