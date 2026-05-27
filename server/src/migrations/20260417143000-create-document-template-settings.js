'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('document_template_settings', {
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
      document_type: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      template_preset: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      document_title_override: {
        type: Sequelize.STRING(120),
        allowNull: false,
        defaultValue: '',
      },
      layout_density: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'comfortable',
      },
      show_logo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      show_seller_block: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      show_buyer_block: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      show_payment_block: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      show_notes_block: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      show_source_reference: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      show_vat_summary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      show_status_badge: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      show_terms_block: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addConstraint('document_template_settings', {
      fields: ['company_id', 'document_type'],
      type: 'unique',
      name: 'document_template_settings_company_type_uniq',
    });

    await queryInterface.addIndex('document_template_settings', ['company_id'], {
      name: 'document_template_settings_company_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('document_template_settings');
  },
};
