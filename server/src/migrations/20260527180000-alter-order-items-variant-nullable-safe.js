'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'order_items';
    const table = await queryInterface.describeTable(tableName);
    if (!table.variant_id) return;

    await queryInterface.changeColumn(tableName, 'variant_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'product_variants', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'order_items';
    const table = await queryInterface.describeTable(tableName);
    if (!table.variant_id) return;

    const [rows] = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int AS c FROM ${tableName} WHERE variant_id IS NULL`
    );
    const nullCount = Number(rows?.[0]?.c || 0);
    if (nullCount > 0) {
      throw new Error(
        `Cannot safely revert ${tableName}.variant_id to NOT NULL: found ${nullCount} rows with NULL variant_id`
      );
    }

    await queryInterface.changeColumn(tableName, 'variant_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'product_variants', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },
};

