'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('company_warehouse_document_settings', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      warehouse_default_document_type: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'wz',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('company_warehouse_document_settings', ['company_id'], {
      unique: true,
      name: 'company_warehouse_document_settings_company_uniq',
    });

    await queryInterface.addConstraint('company_warehouse_document_settings', {
      fields: ['warehouse_default_document_type'],
      type: 'check',
      name: 'company_warehouse_document_settings_default_type_chk',
      where: {
        warehouse_default_document_type: ['pz', 'wz', 'mm', 'rw', 'pw'],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'company_warehouse_document_settings',
      'company_warehouse_document_settings_default_type_chk'
    );
    await queryInterface.removeIndex(
      'company_warehouse_document_settings',
      'company_warehouse_document_settings_company_uniq'
    );
    await queryInterface.dropTable('company_warehouse_document_settings');
  },
};
