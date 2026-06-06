'use strict';

const { Op } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) cost_layers.source_move_id → nullable. OPENING layers have no source move.
    if (!(await isColumnNullable(queryInterface, 'cost_layers', 'source_move_id'))) {
      await queryInterface.sequelize.query(
        'ALTER TABLE cost_layers ALTER COLUMN source_move_id DROP NOT NULL'
      );
    }

    // 2) CHECK constraint so the new nullability cannot be abused for non-opening rows.
    if (!(await hasConstraint(queryInterface, 'cost_layers_source_or_opening_chk'))) {
      await queryInterface.addConstraint('cost_layers', {
        type: 'check',
        fields: ['source_move_id'],
        name: 'cost_layers_source_or_opening_chk',
        where: {
          [Op.or]: [
            { source_move_id: { [Op.ne]: null } },
            { source_ref_type: 'OPENING' },
          ],
        },
      });
    }

    // 3) company_warehouse_document_settings.costing_initialized_at — per-company opt-in flag.
    await addColumnIfMissing(
      queryInterface,
      'company_warehouse_document_settings',
      'costing_initialized_at',
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );
  },

  async down(queryInterface) {
    // 1) Drop the CHECK first; without it, the destructive cleanup below would still trip the rule.
    if (await hasConstraint(queryInterface, 'cost_layers_source_or_opening_chk')) {
      await queryInterface.removeConstraint('cost_layers', 'cost_layers_source_or_opening_chk');
    }

    // 2) Destructive cleanup: OPENING layers cannot survive once NOT NULL returns.
    //    FK on stock_move_cost_allocations.cost_layer_id is ON DELETE CASCADE, so any allocations
    //    that reference these opening layers will be removed with them. This is intentional —
    //    rolling back the opening-balance feature also rolls back the data it created.
    await queryInterface.sequelize.query(
      "DELETE FROM cost_layers WHERE source_move_id IS NULL AND source_ref_type = 'OPENING'"
    );

    // 3) Restore NOT NULL on source_move_id.
    if (await isColumnNullable(queryInterface, 'cost_layers', 'source_move_id')) {
      await queryInterface.sequelize.query(
        'ALTER TABLE cost_layers ALTER COLUMN source_move_id SET NOT NULL'
      );
    }

    // 4) Drop the per-company flag.
    await removeColumnIfExists(
      queryInterface,
      'company_warehouse_document_settings',
      'costing_initialized_at'
    );
  },
};

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function removeColumnIfExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

async function isColumnNullable(queryInterface, tableName, columnName) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT is_nullable FROM information_schema.columns WHERE table_name = :t AND column_name = :c',
    { replacements: { t: tableName, c: columnName } }
  );
  return Boolean(rows[0] && rows[0].is_nullable === 'YES');
}

async function hasConstraint(queryInterface, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT 1 FROM pg_constraint WHERE conname = :n LIMIT 1',
    { replacements: { n: constraintName } }
  );
  return rows.length > 0;
}
