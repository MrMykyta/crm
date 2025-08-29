// src/utils/tx.js
const { sequelize } = require('../models');

/**
 * Универсальный враппер для транзакций Sequelize.
 *
 * @param {Function} fn async (t) => { ... } — функция, в которую передаётся транзакция
 * @param {object|null} tx — существующая транзакция (если уже открыта), иначе создаст новую
 * @returns {Promise<*>} результат выполнения fn
 */
async function withTx(fn, tx = null) {
  if (tx) {
    // если транзакция передана — выполняем внутри неё
    return fn(tx);
  }
  // если нет — создаём новую
  return sequelize.transaction(async (t) => {
    return fn(t);
  });
}

module.exports = { withTx };
