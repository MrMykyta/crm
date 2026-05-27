'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('documents');

    if (!table.source_entity_type) {
      await queryInterface.addColumn('documents', 'source_entity_type', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }

    if (!table.source_entity_id) {
      await queryInterface.addColumn('documents', 'source_entity_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('documents');

    if (table.source_entity_id) {
      await queryInterface.removeColumn('documents', 'source_entity_id');
    }

    if (table.source_entity_type) {
      await queryInterface.removeColumn('documents', 'source_entity_type');
    }
  },
};
