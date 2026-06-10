'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Document-level default locations for MM transfers (MVP: one source + one target).
    await addColumnIfMissing(queryInterface, 'transfer_orders', 'source_location_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, 'transfer_orders', 'target_location_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addIndexIfMissing(queryInterface, 'transfer_orders', ['company_id', 'source_location_id'], {
      name: 'transfer_orders_company_source_location_idx',
    });
    await addIndexIfMissing(queryInterface, 'transfer_orders', ['company_id', 'target_location_id'], {
      name: 'transfer_orders_company_target_location_idx',
    });
  },

  async down(queryInterface) {
    await dropIndexIfExists(queryInterface, 'transfer_orders', 'transfer_orders_company_target_location_idx');
    await dropIndexIfExists(queryInterface, 'transfer_orders', 'transfer_orders_company_source_location_idx');
    await removeColumnIfExists(queryInterface, 'transfer_orders', 'target_location_id');
    await removeColumnIfExists(queryInterface, 'transfer_orders', 'source_location_id');
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

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  if (!(await hasIndex(queryInterface, tableName, options.name))) {
    await queryInterface.addIndex(tableName, fields, options);
  }
}

async function dropIndexIfExists(queryInterface, tableName, indexName) {
  if (await hasIndex(queryInterface, tableName, indexName)) {
    await queryInterface.removeIndex(tableName, indexName);
  }
}
