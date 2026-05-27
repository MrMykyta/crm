'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('company_invoice_settings', {
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
      invoice_default_type: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'invoice',
      },
      invoice_default_payment_method: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'bank_transfer',
      },
      invoice_default_payment_term_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      invoice_default_currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'PLN',
      },
      invoice_stock_update_mode: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'disabled',
      },
      invoice_annotation_mode: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'empty',
      },
      invoice_annotation_template_html: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex('company_invoice_settings', ['company_id'], {
      unique: true,
      name: 'company_invoice_settings_company_uniq',
    });

    await queryInterface.addConstraint('company_invoice_settings', {
      fields: ['invoice_default_type'],
      type: 'check',
      name: 'company_invoice_settings_default_type_chk',
      where: {
        invoice_default_type: [
          'invoice',
          'correction',
          'proforma',
          'advance',
          'advance_proforma',
          'wdt',
        ],
      },
    });

    await queryInterface.addConstraint('company_invoice_settings', {
      fields: ['invoice_default_payment_method'],
      type: 'check',
      name: 'company_invoice_settings_default_payment_method_chk',
      where: {
        invoice_default_payment_method: [
          'bank_transfer',
          'cash',
          'card',
          'blik',
          'online',
          'cash_on_delivery',
          'other',
        ],
      },
    });

    await queryInterface.addConstraint('company_invoice_settings', {
      fields: ['invoice_default_payment_term_days'],
      type: 'check',
      name: 'company_invoice_settings_default_payment_term_days_chk',
      where: {
        invoice_default_payment_term_days: [0, 3, 7, 14, 21, 30, 45, 60, 90],
      },
    });

    await queryInterface.addConstraint('company_invoice_settings', {
      fields: ['invoice_default_currency'],
      type: 'check',
      name: 'company_invoice_settings_default_currency_chk',
      where: {
        invoice_default_currency: [
          'PLN',
          'EUR',
          'USD',
          'GBP',
          'CHF',
          'CZK',
          'SEK',
          'NOK',
          'DKK',
          'UAH',
          'HUF',
          'RON',
          'BGN',
          'TRY',
          'CAD',
          'AUD',
          'JPY',
          'CNY',
        ],
      },
    });

    await queryInterface.addConstraint('company_invoice_settings', {
      fields: ['invoice_stock_update_mode'],
      type: 'check',
      name: 'company_invoice_settings_stock_update_mode_chk',
      where: {
        invoice_stock_update_mode: ['disabled', 'create_warehouse_document'],
      },
    });

    await queryInterface.addConstraint('company_invoice_settings', {
      fields: ['invoice_annotation_mode'],
      type: 'check',
      name: 'company_invoice_settings_annotation_mode_chk',
      where: {
        invoice_annotation_mode: ['empty', 'copy_from_documents', 'template'],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'company_invoice_settings',
      'company_invoice_settings_annotation_mode_chk'
    );
    await queryInterface.removeConstraint(
      'company_invoice_settings',
      'company_invoice_settings_stock_update_mode_chk'
    );
    await queryInterface.removeConstraint(
      'company_invoice_settings',
      'company_invoice_settings_default_currency_chk'
    );
    await queryInterface.removeConstraint(
      'company_invoice_settings',
      'company_invoice_settings_default_payment_term_days_chk'
    );
    await queryInterface.removeConstraint(
      'company_invoice_settings',
      'company_invoice_settings_default_payment_method_chk'
    );
    await queryInterface.removeConstraint(
      'company_invoice_settings',
      'company_invoice_settings_default_type_chk'
    );
    await queryInterface.removeIndex('company_invoice_settings', 'company_invoice_settings_company_uniq');
    await queryInterface.dropTable('company_invoice_settings');
  },
};

