'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'document_template_settings';
    const table = await queryInterface.describeTable(tableName);

    if (!table.section_order) {
      await queryInterface.addColumn(tableName, 'section_order', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'document_template_settings';
    const table = await queryInterface.describeTable(tableName);

    if (table.section_order) {
      await queryInterface.removeColumn(tableName, 'section_order');
    }
  },
};
