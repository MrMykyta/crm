'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('company_invoice_type_settings', {
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
      type_key: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('company_invoice_type_settings', ['company_id', 'type_key'], {
      unique: true,
      name: 'company_invoice_type_settings_company_type_uniq',
    });

    await queryInterface.addConstraint('company_invoice_type_settings', {
      fields: ['type_key'],
      type: 'check',
      name: 'company_invoice_type_settings_type_key_chk',
      where: {
        type_key: [
          'invoice',
          'correction',
          'proforma',
          'advance',
          'advance_proforma',
          'wdt',
        ],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'company_invoice_type_settings',
      'company_invoice_type_settings_type_key_chk'
    );
    await queryInterface.removeIndex(
      'company_invoice_type_settings',
      'company_invoice_type_settings_company_type_uniq'
    );
    await queryInterface.dropTable('company_invoice_type_settings');
  },
};

