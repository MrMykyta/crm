'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'adjustments';
    const table = await queryInterface.describeTable(tableName);

    if (!table.number) {
      await queryInterface.addColumn(tableName, 'number', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }

    if (!table.document_type) {
      await queryInterface.addColumn(tableName, 'document_type', {
        type: Sequelize.ENUM('RW', 'PW'),
        allowNull: true,
      });
    }

    if (!table.status) {
      await queryInterface.addColumn(tableName, 'status', {
        type: Sequelize.ENUM('draft', 'posted'),
        allowNull: true,
        defaultValue: 'draft',
      });
    }

    if (!table.posted_at) {
      await queryInterface.addColumn(tableName, 'posted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE adjustments a
      SET document_type = CASE
        WHEN EXISTS (
          SELECT 1
          FROM adjustment_items ai
          WHERE ai.adjustment_id = a.id
            AND ai.qty_delta < 0
        ) THEN 'RW'::enum_adjustments_document_type
        ELSE 'PW'::enum_adjustments_document_type
      END
      WHERE a.document_type IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE adjustments a
      SET status = CASE
        WHEN EXISTS (
          SELECT 1
          FROM stock_moves sm
          WHERE sm.ref_type IN ('RW', 'PW')
            AND sm.ref_id = a.id
            AND sm.type = 'adjustment'
        ) THEN 'posted'::enum_adjustments_status
        ELSE 'draft'::enum_adjustments_status
      END
      WHERE a.status IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE adjustments
      SET posted_at = created_at
      WHERE status = 'posted' AND posted_at IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE adjustments
      SET number = CONCAT(
        COALESCE(document_type::text, 'PW'),
        '/LEGACY/',
        UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
      )
      WHERE number IS NULL
    `);

    await queryInterface.changeColumn(tableName, 'document_type', {
      type: Sequelize.ENUM('RW', 'PW'),
      allowNull: false,
    });

    await queryInterface.changeColumn(tableName, 'status', {
      type: Sequelize.ENUM('draft', 'posted'),
      allowNull: false,
      defaultValue: 'draft',
    });

    await queryInterface.changeColumn(tableName, 'number', {
      type: Sequelize.STRING(64),
      allowNull: false,
    });

    const indexes = await queryInterface.showIndex(tableName);
    const indexNames = new Set((indexes || []).map((idx) => idx.name));

    if (!indexNames.has('adjustments_company_document_type_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'document_type'], {
        name: 'adjustments_company_document_type_idx',
      });
    }

    if (!indexNames.has('adjustments_company_document_number_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'document_type', 'number'], {
        name: 'adjustments_company_document_number_idx',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'adjustments';
    const indexes = await queryInterface.showIndex(tableName);
    const indexNames = new Set((indexes || []).map((idx) => idx.name));

    if (indexNames.has('adjustments_company_document_number_idx')) {
      await queryInterface.removeIndex(tableName, 'adjustments_company_document_number_idx');
    }

    if (indexNames.has('adjustments_company_document_type_idx')) {
      await queryInterface.removeIndex(tableName, 'adjustments_company_document_type_idx');
    }

    const table = await queryInterface.describeTable(tableName);

    if (table.posted_at) {
      await queryInterface.removeColumn(tableName, 'posted_at');
    }

    if (table.status) {
      await queryInterface.removeColumn(tableName, 'status');
    }

    if (table.document_type) {
      await queryInterface.removeColumn(tableName, 'document_type');
    }

    if (table.number) {
      await queryInterface.removeColumn(tableName, 'number');
    }

    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_adjustments_status\";");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_adjustments_document_type\";");
  },
};
