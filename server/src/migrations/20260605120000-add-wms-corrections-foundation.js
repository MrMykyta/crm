'use strict';

const ENUM_RECEIPTS = 'enum_receipts_status';
const ENUM_SHIPMENTS = 'enum_shipments_status';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    // 1) ENUM extends — add 'corrected' to receipts.status and shipments.status (idempotent).
    //    PG 12+ allows ADD VALUE inside a transaction; we're on PG 16.
    await sequelize.query(`ALTER TYPE "${ENUM_RECEIPTS}" ADD VALUE IF NOT EXISTS 'corrected'`);
    await sequelize.query(`ALTER TYPE "${ENUM_SHIPMENTS}" ADD VALUE IF NOT EXISTS 'corrected'`);

    // 2) receipts: self-FK columns + indexes
    await addColumnIfMissing(queryInterface, 'receipts', 'parent_document_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'receipts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await addColumnIfMissing(queryInterface, 'receipts', 'corrected_by_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'receipts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addIndexIfMissing(queryInterface, 'receipts', ['parent_document_id'], {
      name: 'receipts_parent_document_id_idx',
    });
    await addIndexIfMissing(queryInterface, 'receipts', ['corrected_by_id'], {
      name: 'receipts_corrected_by_id_idx',
    });

    // 3) shipments: self-FK columns + indexes
    await addColumnIfMissing(queryInterface, 'shipments', 'parent_document_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'shipments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await addColumnIfMissing(queryInterface, 'shipments', 'corrected_by_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'shipments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addIndexIfMissing(queryInterface, 'shipments', ['parent_document_id'], {
      name: 'shipments_parent_document_id_idx',
    });
    await addIndexIfMissing(queryInterface, 'shipments', ['corrected_by_id'], {
      name: 'shipments_corrected_by_id_idx',
    });

    // 4) stock_move_cost_allocations — soft-mark reverse fields (G1.2c §10/#5).
    await addColumnIfMissing(queryInterface, 'stock_move_cost_allocations', 'reversed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'stock_move_cost_allocations', 'reversed_by_stock_move_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'stock_moves', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addIndexIfMissing(
      queryInterface,
      'stock_move_cost_allocations',
      ['reversed_by_stock_move_id'],
      { name: 'stock_move_cost_allocations_reversed_by_idx' }
    );

    // 5) stock_moves.reverses_move_id — optional direct audit pointer "this row reverses move X".
    await addColumnIfMissing(queryInterface, 'stock_moves', 'reverses_move_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'stock_moves', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addIndexIfMissing(queryInterface, 'stock_moves', ['reverses_move_id'], {
      name: 'stock_moves_reverses_move_id_idx',
    });
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // 1) Drop indexes + columns (reverse order of up).
    await dropIndexIfExists(queryInterface, 'stock_moves', 'stock_moves_reverses_move_id_idx');
    await removeColumnIfExists(queryInterface, 'stock_moves', 'reverses_move_id');

    await dropIndexIfExists(
      queryInterface,
      'stock_move_cost_allocations',
      'stock_move_cost_allocations_reversed_by_idx'
    );
    await removeColumnIfExists(queryInterface, 'stock_move_cost_allocations', 'reversed_by_stock_move_id');
    await removeColumnIfExists(queryInterface, 'stock_move_cost_allocations', 'reversed_at');

    await dropIndexIfExists(queryInterface, 'shipments', 'shipments_corrected_by_id_idx');
    await dropIndexIfExists(queryInterface, 'shipments', 'shipments_parent_document_id_idx');
    await removeColumnIfExists(queryInterface, 'shipments', 'corrected_by_id');
    await removeColumnIfExists(queryInterface, 'shipments', 'parent_document_id');

    await dropIndexIfExists(queryInterface, 'receipts', 'receipts_corrected_by_id_idx');
    await dropIndexIfExists(queryInterface, 'receipts', 'receipts_parent_document_id_idx');
    await removeColumnIfExists(queryInterface, 'receipts', 'corrected_by_id');
    await removeColumnIfExists(queryInterface, 'receipts', 'parent_document_id');

    // 2) Recreate ENUMs without 'corrected'. First downgrade any 'corrected' rows so the
    //    type-cast doesn't fail (idempotent: NO-OP if no rows match).
    await sequelize.query("UPDATE receipts SET status = 'received' WHERE status = 'corrected'");
    await sequelize.query("UPDATE shipments SET status = 'shipped' WHERE status = 'corrected'");

    // Receipts ENUM — drop the column DEFAULT first; PG can't auto-cast a default expression
    // whose type is being replaced. Restore the default after the column is on the new enum.
    await sequelize.query('ALTER TABLE receipts ALTER COLUMN status DROP DEFAULT');
    await sequelize.query(`ALTER TYPE "${ENUM_RECEIPTS}" RENAME TO "${ENUM_RECEIPTS}_old"`);
    await sequelize.query(`CREATE TYPE "${ENUM_RECEIPTS}" AS ENUM ('draft','received','putaway')`);
    await sequelize.query(
      `ALTER TABLE receipts ALTER COLUMN status TYPE "${ENUM_RECEIPTS}" USING status::text::"${ENUM_RECEIPTS}"`
    );
    await sequelize.query(
      `ALTER TABLE receipts ALTER COLUMN status SET DEFAULT 'draft'::"${ENUM_RECEIPTS}"`
    );
    await sequelize.query(`DROP TYPE "${ENUM_RECEIPTS}_old"`);

    // Shipments ENUM — same pattern with default 'packing'.
    await sequelize.query('ALTER TABLE shipments ALTER COLUMN status DROP DEFAULT');
    await sequelize.query(`ALTER TYPE "${ENUM_SHIPMENTS}" RENAME TO "${ENUM_SHIPMENTS}_old"`);
    await sequelize.query(`CREATE TYPE "${ENUM_SHIPMENTS}" AS ENUM ('packing','shipped','cancelled')`);
    await sequelize.query(
      `ALTER TABLE shipments ALTER COLUMN status TYPE "${ENUM_SHIPMENTS}" USING status::text::"${ENUM_SHIPMENTS}"`
    );
    await sequelize.query(
      `ALTER TABLE shipments ALTER COLUMN status SET DEFAULT 'packing'::"${ENUM_SHIPMENTS}"`
    );
    await sequelize.query(`DROP TYPE "${ENUM_SHIPMENTS}_old"`);
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
