const { Sequence, sequelize } = require('../../models');

module.exports.next = async (companyId, scope) => {
  const year = new Date().getFullYear();

  return sequelize.transaction(async (t) => {
    // lock row (or create it) and increment safely
    let row = await Sequence.findOne({
      where: { companyId, scope, year },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!row) {
      row = await Sequence.create({ companyId, scope, year, value: 0 }, { transaction: t });
    }
    const nextValue = row.value + 1;
    await row.update({ value: nextValue }, { transaction: t });

    // формат номера: OFF-2025-000123 или ORD-2025-000123
    const prefix = scope === 'offer' ? 'OFF' : 'ORD';
    const number = `${prefix}-${year}-${String(nextValue).padStart(6, '0')}`;
    return { number, year, nextValue };
  });
};
