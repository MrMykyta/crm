'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE count_items
        ALTER COLUMN location_id DROP NOT NULL;
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(`
        SELECT COUNT(*)::int AS count
        FROM count_items
        WHERE location_id IS NULL;
      `, { transaction });
      const nullCount = Number(rows?.[0]?.count || 0);
      if (nullCount > 0) {
        throw new Error(
          `Cannot revert WMS-POLICY-2C-5: count_items contains ${nullCount} rows with location_id NULL. ` +
          'Move or remove those rows before restoring location_id NOT NULL.'
        );
      }

      await queryInterface.sequelize.query(`
        ALTER TABLE count_items
        ALTER COLUMN location_id SET NOT NULL;
      `, { transaction });
    });
  },
};
