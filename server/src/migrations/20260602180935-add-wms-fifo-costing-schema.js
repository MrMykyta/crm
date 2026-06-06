'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'receipt_items', 'unit_cost', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'receipt_items', 'total_cost', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'receipt_items', 'currency', {
      type: Sequelize.STRING(3),
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, 'adjustment_items', 'unit_cost', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'adjustment_items', 'total_cost', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'adjustment_items', 'currency', {
      type: Sequelize.STRING(3),
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, 'stock_moves', 'unit_cost', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'stock_moves', 'total_cost', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'stock_moves', 'currency', {
      type: Sequelize.STRING(3),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'stock_moves', 'cost_method', {
      type: Sequelize.STRING(16),
      allowNull: true,
    });

    await addColumnIfMissing(
      queryInterface,
      'company_warehouse_document_settings',
      'inventory_cost_method',
      {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'FIFO',
      }
    );

    await createCostLayersTable(queryInterface, Sequelize);
    await createStockMoveCostAllocationsTable(queryInterface, Sequelize);
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'stock_move_cost_allocations');
    await dropTableIfExists(queryInterface, 'cost_layers');

    await removeColumnIfExists(
      queryInterface,
      'company_warehouse_document_settings',
      'inventory_cost_method'
    );

    await removeColumnIfExists(queryInterface, 'stock_moves', 'cost_method');
    await removeColumnIfExists(queryInterface, 'stock_moves', 'currency');
    await removeColumnIfExists(queryInterface, 'stock_moves', 'total_cost');
    await removeColumnIfExists(queryInterface, 'stock_moves', 'unit_cost');

    await removeColumnIfExists(queryInterface, 'adjustment_items', 'currency');
    await removeColumnIfExists(queryInterface, 'adjustment_items', 'total_cost');
    await removeColumnIfExists(queryInterface, 'adjustment_items', 'unit_cost');

    await removeColumnIfExists(queryInterface, 'receipt_items', 'currency');
    await removeColumnIfExists(queryInterface, 'receipt_items', 'total_cost');
    await removeColumnIfExists(queryInterface, 'receipt_items', 'unit_cost');
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

async function hasTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    if (typeof table === 'string') return table === tableName;
    return table.tableName === tableName;
  });
}

async function dropTableIfExists(queryInterface, tableName) {
  if (await hasTable(queryInterface, tableName)) {
    await queryInterface.dropTable(tableName);
  }
}

async function createCostLayersTable(queryInterface, Sequelize) {
  if (await hasTable(queryInterface, 'cost_layers')) return;

  await queryInterface.createTable('cost_layers', {
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
    warehouse_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'warehouses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    location_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    product_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'products', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    variant_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'product_variants', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    source_move_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'stock_moves', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    source_ref_type: {
      type: Sequelize.STRING(32),
      allowNull: true,
    },
    source_ref_id: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    source_ref_item_id: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    qty_in: {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
      defaultValue: 0,
    },
    qty_remaining: {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
      defaultValue: 0,
    },
    unit_cost: {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
    },
    total_cost: {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
    },
    currency: {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: 'PLN',
    },
    received_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
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

  await queryInterface.addIndex('cost_layers', ['source_move_id'], {
    unique: true,
    name: 'cost_layers_source_move_uniq',
  });
  await queryInterface.addIndex('cost_layers', ['company_id', 'warehouse_id', 'product_id', 'variant_id'], {
    name: 'cost_layers_stock_scope_idx',
  });
  await queryInterface.addIndex(
    'cost_layers',
    ['company_id', 'warehouse_id', 'location_id', 'product_id', 'variant_id', 'received_at'],
    { name: 'cost_layers_fifo_scope_idx' }
  );
  await queryInterface.addIndex('cost_layers', ['company_id', 'source_ref_type', 'source_ref_id'], {
    name: 'cost_layers_source_ref_idx',
  });
  await queryInterface.addIndex('cost_layers', ['source_ref_item_id'], {
    name: 'cost_layers_source_ref_item_idx',
  });
  await queryInterface.addIndex('cost_layers', ['qty_remaining'], {
    name: 'cost_layers_qty_remaining_idx',
  });
}

async function createStockMoveCostAllocationsTable(queryInterface, Sequelize) {
  if (await hasTable(queryInterface, 'stock_move_cost_allocations')) return;

  await queryInterface.createTable('stock_move_cost_allocations', {
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
    stock_move_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'stock_moves', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    cost_layer_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'cost_layers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    qty: {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
    },
    unit_cost: {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
    },
    total_cost: {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
    },
    currency: {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: 'PLN',
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

  await queryInterface.addIndex('stock_move_cost_allocations', ['stock_move_id'], {
    name: 'stock_move_cost_allocations_move_idx',
  });
  await queryInterface.addIndex('stock_move_cost_allocations', ['cost_layer_id'], {
    name: 'stock_move_cost_allocations_layer_idx',
  });
  await queryInterface.addIndex('stock_move_cost_allocations', ['company_id', 'stock_move_id'], {
    name: 'stock_move_cost_allocations_company_move_idx',
  });
  await queryInterface.addIndex('stock_move_cost_allocations', ['stock_move_id', 'cost_layer_id'], {
    unique: true,
    name: 'stock_move_cost_allocations_move_layer_uniq',
  });
}
