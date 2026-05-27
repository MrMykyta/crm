'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('document_numbering_settings', 'enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('document_numbering_settings', 'pattern', {
      type: Sequelize.STRING(180),
      allowNull: false,
      defaultValue: 'DOC/{YYYY}/{SEQ:4}',
    });

    await queryInterface.addColumn('document_numbering_settings', 'sequence_counter', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('document_numbering_settings', 'last_number', {
      type: Sequelize.STRING(180),
      allowNull: true,
    });

    await queryInterface.addColumn('document_numbering_settings', 'reset_policy', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'yearly',
    });

    await queryInterface.addColumn('document_numbering_settings', 'last_generated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('document_numbering_settings', 'last_reset_token', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: '',
    });

    await queryInterface.sequelize.query(`
      UPDATE document_numbering_settings
      SET
        enabled = COALESCE(is_auto_enabled, true),
        sequence_counter = GREATEST(COALESCE(current_number, 0), 0),
        reset_policy = CASE COALESCE(reset_period, 'yearly')
          WHEN 'never' THEN 'none'
          WHEN 'monthly' THEN 'monthly'
          ELSE 'yearly'
        END,
        pattern = CASE
          WHEN COALESCE(format_preset, 'PREFIX-YYYY-NNNN') = 'PREFIX-YYYY-MM-NNNN'
            THEN CONCAT(COALESCE(NULLIF(prefix, ''), 'DOC'), '/{YYYY}/{MM}/{SEQ:4}')
          ELSE CONCAT(COALESCE(NULLIF(prefix, ''), 'DOC'), '/{YYYY}/{SEQ:4}')
        END,
        last_reset_token = CASE COALESCE(reset_period, 'yearly')
          WHEN 'monthly' THEN TO_CHAR(NOW(), 'YYYY-MM')
          WHEN 'yearly' THEN TO_CHAR(NOW(), 'YYYY')
          ELSE 'none'
        END
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('document_numbering_settings', 'last_reset_token');
    await queryInterface.removeColumn('document_numbering_settings', 'last_generated_at');
    await queryInterface.removeColumn('document_numbering_settings', 'reset_policy');
    await queryInterface.removeColumn('document_numbering_settings', 'last_number');
    await queryInterface.removeColumn('document_numbering_settings', 'sequence_counter');
    await queryInterface.removeColumn('document_numbering_settings', 'pattern');
    await queryInterface.removeColumn('document_numbering_settings', 'enabled');
  },
};

