'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('templates', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      documentTypeKey: {
        type: Sequelize.STRING(64),
        allowNull: false,
        field: 'document_type_key',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'draft',
      },
      scope: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'custom',
      },
      currentVersionId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'current_version_id',
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'created_by',
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        field: 'created_at',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at',
      },
    });

    await queryInterface.addIndex('templates', ['company_id', 'document_type_key'], {
      name: 'templates_company_doc_type_idx',
    });
    await queryInterface.addIndex('templates', ['company_id', 'status'], {
      name: 'templates_company_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('templates');
  },
};
