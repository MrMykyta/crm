'use strict';

// A2 — Line item foundation.
// Schema-only migration that prepares Offer / Order / Invoice line items for the unified
// LineItem model from PRODUCT_SERVICE_ORDER_INTEGRATION_AUDIT.md. No runtime behavior
// changes yet — that's A3. After this migration:
//   - products.is_service BOOLEAN (default false)
//   - offer_items / order_items gain: line_type ENUM, affects_inventory BOOL,
//     is_stock_tracked_snapshot BOOL, tax_category_id FK, parent_line_item_id self-FK
//   - new invoice_items table with the full LineItem column set
//   - backfill: line_type / affects_inventory / is_stock_tracked_snapshot inferred from
//     joined products.is_service + products.track_inventory; custom lines stay 'custom'
//
// Idempotent up + symmetric down (drops only the new objects, leaves untouched
// historical data alone).

const ENUM_LINE_TYPE = 'product_service_line_type';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    // ----------------------------------------------------------------------------
    // 1) Shared ENUM type for line_type
    // ----------------------------------------------------------------------------
    await sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${ENUM_LINE_TYPE}') THEN
          CREATE TYPE "${ENUM_LINE_TYPE}" AS ENUM ('product','service','custom','fee','discount');
        END IF;
      END $$;
    `);

    // ----------------------------------------------------------------------------
    // 2) products.is_service
    // ----------------------------------------------------------------------------
    await addColumnIfMissing(queryInterface, 'products', 'is_service', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addIndexIfMissing(queryInterface, 'products', ['company_id', 'is_service'], {
      name: 'products_company_is_service_idx',
    });

    // ----------------------------------------------------------------------------
    // 3) offer_items new columns
    // ----------------------------------------------------------------------------
    await addLineTypeColumn(queryInterface, sequelize, 'offer_items');
    await addBoolColumnIfMissing(queryInterface, Sequelize, 'offer_items', 'affects_inventory');
    await addBoolColumnIfMissing(queryInterface, Sequelize, 'offer_items', 'is_stock_tracked_snapshot');
    await addColumnIfMissing(queryInterface, 'offer_items', 'tax_category_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'tax_categories', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, 'offer_items', 'parent_line_item_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'offer_items', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await addIndexIfMissing(queryInterface, 'offer_items', ['company_id', 'line_type'], {
      name: 'offer_items_company_line_type_idx',
    });
    await addIndexIfMissing(queryInterface, 'offer_items', ['company_id', 'affects_inventory'], {
      name: 'offer_items_company_affects_inventory_idx',
    });

    // ----------------------------------------------------------------------------
    // 4) order_items new columns
    // ----------------------------------------------------------------------------
    await addLineTypeColumn(queryInterface, sequelize, 'order_items');
    await addBoolColumnIfMissing(queryInterface, Sequelize, 'order_items', 'affects_inventory');
    await addBoolColumnIfMissing(queryInterface, Sequelize, 'order_items', 'is_stock_tracked_snapshot');
    await addColumnIfMissing(queryInterface, 'order_items', 'tax_category_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'tax_categories', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, 'order_items', 'parent_line_item_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'order_items', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await addIndexIfMissing(queryInterface, 'order_items', ['company_id', 'line_type'], {
      name: 'order_items_company_line_type_idx',
    });
    await addIndexIfMissing(queryInterface, 'order_items', ['company_id', 'affects_inventory'], {
      name: 'order_items_company_affects_inventory_idx',
    });
    await addIndexIfMissing(
      queryInterface,
      'order_items',
      ['company_id', 'product_id', 'affects_inventory'],
      { name: 'order_items_company_product_affects_inventory_idx' }
    );

    // ----------------------------------------------------------------------------
    // 5) Backfill offer_items + order_items from joined products.
    //    Rules:
    //      - product_id IS NULL  OR is_custom_line=true → 'custom'
    //      - product.is_service=true                    → 'service'
    //      - otherwise                                  → 'product'
    //    affects_inventory = (line_type='product' AND product.track_inventory)
    //    is_stock_tracked_snapshot = COALESCE(product.track_inventory, false)
    // ----------------------------------------------------------------------------
    await backfillLineFields(sequelize, 'offer_items');
    await backfillLineFields(sequelize, 'order_items');

    // ----------------------------------------------------------------------------
    // 6) invoice_items table
    // ----------------------------------------------------------------------------
    if (!(await hasTable(queryInterface, 'invoice_items'))) {
      await queryInterface.createTable('invoice_items', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        company_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'companies', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        invoice_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'invoices', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        order_item_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'order_items', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        product_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'products', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        variant_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'product_variants', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        tax_category_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'tax_categories', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        parent_line_item_id: {
          type: Sequelize.UUID,
          allowNull: true,
          // self-FK added separately below so referenced table exists
        },
        line_type: {
          type: `"${ENUM_LINE_TYPE}"`,
          allowNull: false,
          defaultValue: 'product',
        },
        affects_inventory: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        is_stock_tracked_snapshot: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        sku_snapshot: { type: Sequelize.STRING(128), allowNull: true },
        name_snapshot: { type: Sequelize.STRING(512), allowNull: false },
        description_snapshot: { type: Sequelize.TEXT, allowNull: true },
        unit_snapshot: { type: Sequelize.STRING(64), allowNull: true },
        product_type_snapshot: { type: Sequelize.STRING(64), allowNull: true },
        metadata_snapshot: { type: Sequelize.JSONB, allowNull: true },
        qty: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 1 },
        price_net: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        price_gross: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        tax_rate: { type: Sequelize.DECIMAL(7, 4), allowNull: false, defaultValue: 0 },
        discount_type: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'none' },
        discount_value: { type: Sequelize.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
        discount_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        line_subtotal_net: { type: Sequelize.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
        line_vat: { type: Sequelize.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
        line_total_net: { type: Sequelize.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
        line_total_gross: { type: Sequelize.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
        notes: { type: Sequelize.TEXT, allowNull: true },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });

      // self-FK after the table exists
      await sequelize.query(`
        ALTER TABLE invoice_items
        ADD CONSTRAINT invoice_items_parent_line_item_id_fkey
        FOREIGN KEY (parent_line_item_id) REFERENCES invoice_items(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
      `);
    }

    await addIndexIfMissing(queryInterface, 'invoice_items', ['company_id', 'invoice_id'], {
      name: 'invoice_items_company_invoice_idx',
    });
    await addIndexIfMissing(queryInterface, 'invoice_items', ['company_id', 'line_type'], {
      name: 'invoice_items_company_line_type_idx',
    });
    await addIndexIfMissing(queryInterface, 'invoice_items', ['company_id', 'product_id'], {
      name: 'invoice_items_company_product_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    // 1) Drop invoice_items table (with cascading FK to itself + invoices CASCADE handles owned rows).
    if (await hasTable(queryInterface, 'invoice_items')) {
      await queryInterface.dropTable('invoice_items');
    }

    // 2) order_items rollback
    await dropIndexIfExists(
      queryInterface,
      'order_items',
      'order_items_company_product_affects_inventory_idx'
    );
    await dropIndexIfExists(queryInterface, 'order_items', 'order_items_company_affects_inventory_idx');
    await dropIndexIfExists(queryInterface, 'order_items', 'order_items_company_line_type_idx');
    await removeColumnIfExists(queryInterface, 'order_items', 'parent_line_item_id');
    await removeColumnIfExists(queryInterface, 'order_items', 'tax_category_id');
    await removeColumnIfExists(queryInterface, 'order_items', 'is_stock_tracked_snapshot');
    await removeColumnIfExists(queryInterface, 'order_items', 'affects_inventory');
    await removeColumnIfExists(queryInterface, 'order_items', 'line_type');

    // 3) offer_items rollback
    await dropIndexIfExists(queryInterface, 'offer_items', 'offer_items_company_affects_inventory_idx');
    await dropIndexIfExists(queryInterface, 'offer_items', 'offer_items_company_line_type_idx');
    await removeColumnIfExists(queryInterface, 'offer_items', 'parent_line_item_id');
    await removeColumnIfExists(queryInterface, 'offer_items', 'tax_category_id');
    await removeColumnIfExists(queryInterface, 'offer_items', 'is_stock_tracked_snapshot');
    await removeColumnIfExists(queryInterface, 'offer_items', 'affects_inventory');
    await removeColumnIfExists(queryInterface, 'offer_items', 'line_type');

    // 4) products rollback
    await dropIndexIfExists(queryInterface, 'products', 'products_company_is_service_idx');
    await removeColumnIfExists(queryInterface, 'products', 'is_service');

    // 5) Drop shared ENUM (only if no remaining columns of that type — Sequelize uses
    //    auto-named enums for ENUM column definitions, but we created ours explicitly,
    //    so it's safe to drop after the columns are gone).
    await sequelize.query(`DROP TYPE IF EXISTS "${ENUM_LINE_TYPE}";`);
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function hasTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName) || tables.includes(`"${tableName}"`);
}

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

async function addLineTypeColumn(queryInterface, sequelize, tableName) {
  const table = await queryInterface.describeTable(tableName);
  if (table.line_type) return;
  // Raw SQL because Sequelize.ENUM() would create a per-table enum type instead of
  // reusing the shared product_service_line_type we already created.
  await sequelize.query(`
    ALTER TABLE ${tableName}
    ADD COLUMN line_type "${ENUM_LINE_TYPE}" NOT NULL DEFAULT 'product'::"${ENUM_LINE_TYPE}";
  `);
}

async function addBoolColumnIfMissing(queryInterface, Sequelize, tableName, columnName) {
  await addColumnIfMissing(queryInterface, tableName, columnName, {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
}

async function backfillLineFields(sequelize, tableName) {
  // Single statement: classify line_type by join + is_custom_line, set the two booleans.
  await sequelize.query(`
    UPDATE ${tableName} AS it
    SET
      line_type = CASE
        WHEN it.product_id IS NULL OR it.is_custom_line = true
          THEN 'custom'::"${ENUM_LINE_TYPE}"
        WHEN p.is_service = true
          THEN 'service'::"${ENUM_LINE_TYPE}"
        ELSE 'product'::"${ENUM_LINE_TYPE}"
      END,
      is_stock_tracked_snapshot = COALESCE(p.track_inventory, false),
      affects_inventory = CASE
        WHEN it.product_id IS NULL OR it.is_custom_line = true THEN false
        WHEN p.is_service = true THEN false
        ELSE COALESCE(p.track_inventory, false)
      END
    FROM ${tableName} AS it2
    LEFT JOIN products p ON p.id = it2.product_id
    WHERE it.id = it2.id;
  `);
}
