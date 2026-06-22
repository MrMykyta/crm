
// pickService.js (generated)
const { withTx } = require('../../utils/tx');
const Inventory = require('./inventoryService');
const { PickWave, PickTask, Reservation } = require('../../models');

const taskCompanyScopeInclude = (companyId) => ({
  model: PickWave,
  as: 'wave',
  attributes: [],
  required: true,
  where: { companyId },
});

// createWave: создаёт новую запись и возвращает результат.
module.exports.createWave = async (companyId, { warehouseId, reservations=[], reference }, outerTx=null) => {
  return await withTx(async (t) => {
    const wave = await PickWave.create({ companyId, warehouseId, reference, status:'open' }, { transaction:t });
    for (const rId of reservations) {
      const r = await Reservation.findOne({ where:{ companyId, id: rId }, transaction:t });
      if (!r || r.status !== 'reserved') continue;
      await PickTask.create({ waveId: wave.id, reservationId: r.id, status:'open', qty: r.qty }, { transaction:t });
    }
    return wave;
  }, outerTx);
};

// completeTask: выполняет вспомогательную бизнес-логику сервиса.
module.exports.completeTask = async (companyId, taskId, outerTx=null) => {
  return await withTx(async (t) => {
    const task = await PickTask.findOne({
      where:{ id: taskId },
      include:[taskCompanyScopeInclude(companyId), { model: Reservation }],
      transaction:t,
    });
    if (!task) return null;
    const r = task.reservation;
    await Inventory.applyMove(
      {
        companyId,
        type: 'pick',
        warehouseId: r.warehouseId,
        productId: r.productId,
        variantId: r.variantId || null,
        qty: r.qty,
        fromLocationId: r.locationId,
        toLocationId: r.pickToLocationId || null,
        lotId: r.lotId || null,
      },
      { transaction: t }
    );
    await task.update({ status:'done' }, { transaction:t });
    await r.update({ status:'picked' }, { transaction:t });
    return task;
  }, outerTx);
};
