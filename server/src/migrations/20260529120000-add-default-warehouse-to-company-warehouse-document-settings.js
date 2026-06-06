'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'company_warehouse_document_settings',
      'default_warehouse_id',
      {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'warehouses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('company_warehouse_document_settings', 'default_warehouse_id');
  },
};
