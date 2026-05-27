'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('template_version_content', {
      templateVersionId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'template_version_id',
        references: { model: 'template_versions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('template_version_content');
  },
};
