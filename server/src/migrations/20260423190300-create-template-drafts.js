'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('template_drafts', {
      templateId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'template_id',
        references: { model: 'templates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      schemaVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'schema_version',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at',
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'updated_by',
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    });

    await queryInterface.addIndex('template_drafts', ['updated_at'], {
      name: 'template_drafts_updated_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('template_drafts');
  },
};
