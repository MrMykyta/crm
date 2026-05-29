'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE order_items ALTER COLUMN variant_id DROP NOT NULL;'
    );
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      'SELECT COUNT(*)::int AS c FROM order_items WHERE variant_id IS NULL;'
    );
    const nullCount = Number(rows?.[0]?.c || 0);
    if (nullCount > 0) {
      throw new Error(
        `Cannot safely set order_items.variant_id back to NOT NULL: found ${nullCount} NULL rows`
      );
    }
    await queryInterface.sequelize.query(
      'ALTER TABLE order_items ALTER COLUMN variant_id SET NOT NULL;'
    );
  },
};

