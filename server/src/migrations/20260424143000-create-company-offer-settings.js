'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('company_offer_settings', {
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
      offer_annotation_mode: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'empty',
      },
      offer_annotation_template_html: {
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

    await queryInterface.addIndex('company_offer_settings', ['company_id'], {
      unique: true,
      name: 'company_offer_settings_company_uniq',
    });

    await queryInterface.addConstraint('company_offer_settings', {
      fields: ['offer_annotation_mode'],
      type: 'check',
      name: 'company_offer_settings_annotation_mode_chk',
      where: {
        offer_annotation_mode: ['empty', 'copy_from_documents', 'template'],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('company_offer_settings', 'company_offer_settings_annotation_mode_chk');
    await queryInterface.removeIndex('company_offer_settings', 'company_offer_settings_company_uniq');
    await queryInterface.dropTable('company_offer_settings');
  },
};
