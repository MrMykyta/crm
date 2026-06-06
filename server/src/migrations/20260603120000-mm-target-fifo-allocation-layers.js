'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Drop the UNIQUE on source_move_id — one incoming move may now produce N target layers (MM transfer).
    await dropIndexIfExists(queryInterface, 'cost_layers', 'cost_layers_source_move_uniq');

    // 2) Replace with a plain non-unique index so source_move_id lookups stay fast.
    await addIndexIfMissing(queryInterface, 'cost_layers', ['source_move_id'], {
      name: 'cost_layers_source_move_idx',
    });

    // 3) Add source_allocation_id pointing to the source-side allocation that produced this target layer.
    await addColumnIfMissing(queryInterface, 'cost_layers', 'source_allocation_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'stock_move_cost_allocations',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // 4) One allocation produces at most one target layer — partial unique guards against duplicate MM target layers.
    await addIndexIfMissing(queryInterface, 'cost_layers', ['source_allocation_id'], {
      unique: true,
      where: { source_allocation_id: { [Sequelize.Op.ne]: null } },
      name: 'cost_layers_source_allocation_uniq',
    });
  },

  async down(queryInterface, Sequelize) {
    await dropIndexIfExists(queryInterface, 'cost_layers', 'cost_layers_source_allocation_uniq');
    await removeColumnIfExists(queryInterface, 'cost_layers', 'source_allocation_id');
    await dropIndexIfExists(queryInterface, 'cost_layers', 'cost_layers_source_move_idx');
    await addIndexIfMissing(queryInterface, 'cost_layers', ['source_move_id'], {
      unique: true,
      name: 'cost_layers_source_move_uniq',
    });
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

async function hasIndex(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((idx) => idx.name === indexName);
}

async function dropIndexIfExists(queryInterface, tableName, indexName) {
  if (await hasIndex(queryInterface, tableName, indexName)) {
    await queryInterface.removeIndex(tableName, indexName);
  }
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  if (!(await hasIndex(queryInterface, tableName, options.name))) {
    await queryInterface.addIndex(tableName, fields, options);
  }
}
