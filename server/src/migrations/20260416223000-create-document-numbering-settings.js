'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('document_numbering_settings', {
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
      prefix: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      format_preset: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      reset_period: {
        type: Sequelize.STRING(16),
        allowNull: false,
      },
      start_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      current_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_auto_enabled: {
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

    await queryInterface.addConstraint('document_numbering_settings', {
      fields: ['company_id', 'document_type'],
      type: 'unique',
      name: 'document_numbering_settings_company_type_uniq',
    });

    await queryInterface.addIndex('document_numbering_settings', ['company_id'], {
      name: 'document_numbering_settings_company_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('document_numbering_settings');
  },
};
