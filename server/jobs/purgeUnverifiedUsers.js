// src/jobs/purgeUnverifiedUsers.js
const { Op } = require('sequelize');
const { sequelize, User } = require('../src/models'); // проверь путь к index.js моделей

module.exports.run = async () => {
  const now = new Date();

  // всё в транзакции на всякий
  return sequelize.transaction(async (t) => {
    const candidates = await User.findAll({
      where: {
        email_verified_at: { [Op.is]: null },
        verification_expires_at: { [Op.lt]: now }
      },
      transaction: t
    });

    // если на зависимых таблицах стоят FK ... ON DELETE CASCADE,
    // достаточно просто удалить user. Иначе — подчистить вручную тут.
    for (const u of candidates) {
      await u.destroy({ transaction: t, force: true }); // force:true если model paranoid
    }

    return { deleted: candidates.length };
  });
};