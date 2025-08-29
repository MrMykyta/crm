// src/utils/withCompany.js

/**
 * Оборачивает where условие, добавляя companyId.
 *
 * @param {string|number} companyId - id компании
 * @param {object} where - исходный where объект
 * @returns {object} новый where с companyId
 */
function withCompany(companyId, where = {}) {
  if (!companyId) {
    throw new Error('companyId is required for multi-tenant queries');
  }
  return { ...where, companyId };
}

module.exports = { withCompany };
