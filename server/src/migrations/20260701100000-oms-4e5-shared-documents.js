'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shared_documents', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      file_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      source_entity_type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      source_entity_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      token: {
        type: Sequelize.UUID,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      view_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      download_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      generated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
      generated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      template_version_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      render_dto_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
    });

    await queryInterface.addIndex('shared_documents', ['token'], {
      name: 'shared_documents_token_uidx',
      unique: true,
    });
    await queryInterface.addIndex('shared_documents', ['company_id', 'source_entity_type', 'source_entity_id'], {
      name: 'shared_documents_company_source_idx',
    });
    await queryInterface.addIndex('shared_documents', ['document_id'], {
      name: 'shared_documents_document_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shared_documents');
  },
};
