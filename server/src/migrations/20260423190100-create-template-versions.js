'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('template_versions', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      templateId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'template_id',
        references: { model: 'templates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      versionNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
        field: 'version_number',
      },
      schemaVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'schema_version',
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'published',
      },
      contentHash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        field: 'content_hash',
      },
      publisherId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'publisher_id',
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      publishedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        field: 'published_at',
      },
      changelog: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    });

    await queryInterface.addConstraint('template_versions', {
      fields: ['template_id', 'version_number'],
      type: 'unique',
      name: 'template_versions_template_version_uniq',
    });

    await queryInterface.addIndex('template_versions', ['template_id', 'published_at'], {
      name: 'template_versions_template_published_idx',
    });

    await queryInterface.addConstraint('templates', {
      fields: ['current_version_id'],
      type: 'foreign key',
      name: 'templates_current_version_fk',
      references: {
        table: 'template_versions',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('templates', 'templates_current_version_fk');
    await queryInterface.dropTable('template_versions');
  },
};
