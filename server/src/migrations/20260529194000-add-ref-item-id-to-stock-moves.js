'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'stock_moves';
    const table = await queryInterface.describeTable(tableName);

    if (!table.ref_item_id) {
      await queryInterface.addColumn(tableName, 'ref_item_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex(tableName);
    const indexNames = new Set((indexes || []).map((idx) => idx.name));

    if (!indexNames.has('stock_moves_ref_item_idx')) {
      await queryInterface.addIndex(tableName, ['ref_item_id'], {
        name: 'stock_moves_ref_item_idx',
      });
    }

    if (!indexNames.has('stock_moves_ref_doc_item_idx')) {
      await queryInterface.addIndex(tableName, ['ref_type', 'ref_id', 'ref_item_id'], {
        name: 'stock_moves_ref_doc_item_idx',
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'stock_moves';
    const indexes = await queryInterface.showIndex(tableName);
    const indexNames = new Set((indexes || []).map((idx) => idx.name));

    if (indexNames.has('stock_moves_ref_doc_item_idx')) {
      await queryInterface.removeIndex(tableName, 'stock_moves_ref_doc_item_idx');
    }

    if (indexNames.has('stock_moves_ref_item_idx')) {
      await queryInterface.removeIndex(tableName, 'stock_moves_ref_item_idx');
    }

    const table = await queryInterface.describeTable(tableName);
    if (table.ref_item_id) {
      await queryInterface.removeColumn(tableName, 'ref_item_id');
    }
  },
};
