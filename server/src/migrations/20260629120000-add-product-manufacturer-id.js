'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable('products');

      if (!table.manufacturer_id) {
        await queryInterface.addColumn('products', 'manufacturer_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'counterparties',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }, { transaction });
      }

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS products_manufacturer_id_idx
        ON products (manufacturer_id)
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS products_manufacturer_id_idx', { transaction });

      const table = await queryInterface.describeTable('products');
      if (table.manufacturer_id) {
        await queryInterface.removeColumn('products', 'manufacturer_id', { transaction });
      }
    });
  },
};
