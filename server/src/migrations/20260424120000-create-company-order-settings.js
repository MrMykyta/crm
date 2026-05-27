'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('company_order_settings', {
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
      order_product_reservation_mode: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'disabled',
      },
      order_annotation_mode: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'empty',
      },
      order_annotation_template_html: {
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

    await queryInterface.addIndex('company_order_settings', ['company_id'], {
      unique: true,
      name: 'company_order_settings_company_uniq',
    });

    await queryInterface.addConstraint('company_order_settings', {
      fields: ['order_product_reservation_mode'],
      type: 'check',
      name: 'company_order_settings_reservation_mode_chk',
      where: {
        order_product_reservation_mode: ['disabled', 'enabled'],
      },
    });

    await queryInterface.addConstraint('company_order_settings', {
      fields: ['order_annotation_mode'],
      type: 'check',
      name: 'company_order_settings_annotation_mode_chk',
      where: {
        order_annotation_mode: ['empty', 'copy_from_documents', 'template'],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('company_order_settings', 'company_order_settings_annotation_mode_chk');
    await queryInterface.removeConstraint('company_order_settings', 'company_order_settings_reservation_mode_chk');
    await queryInterface.removeIndex('company_order_settings', 'company_order_settings_company_uniq');
    await queryInterface.dropTable('company_order_settings');
  },
};
