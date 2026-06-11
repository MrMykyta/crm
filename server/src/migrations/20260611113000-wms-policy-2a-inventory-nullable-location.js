'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await assertNoNormalizedDuplicates(queryInterface, transaction);

      await queryInterface.sequelize.query(`
        ALTER TABLE inventory_items
        DROP CONSTRAINT IF EXISTS uniq_invitem_loc_prod_variant_lot_serial;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE inventory_items
        ALTER COLUMN location_id DROP NOT NULL;
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_stock_key_uniq
        ON inventory_items (
          company_id,
          warehouse_id,
          COALESCE(location_id, '${ZERO_UUID}'::uuid),
          product_id,
          COALESCE(variant_id, '${ZERO_UUID}'::uuid),
          COALESCE(lot_id, '${ZERO_UUID}'::uuid),
          COALESCE(serial_id, '${ZERO_UUID}'::uuid)
        );
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS inventory_items_company_warehouse_product_variant_idx
        ON inventory_items (company_id, warehouse_id, product_id, variant_id);
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS inventory_items_company_warehouse_location_idx
        ON inventory_items (company_id, warehouse_id, location_id);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [nullRows] = await queryInterface.sequelize.query(`
        SELECT COUNT(*)::int AS count
        FROM inventory_items
        WHERE location_id IS NULL;
      `, { transaction });
      const nullCount = Number(nullRows?.[0]?.count || 0);
      if (nullCount > 0) {
        throw new Error(
          `Cannot revert WMS-POLICY-2A: inventory_items contains ${nullCount} warehouse-level rows with location_id NULL. ` +
          'Move or remove those rows before restoring location_id NOT NULL.'
        );
      }

      await queryInterface.sequelize.query(`
        ALTER TABLE inventory_items
        ALTER COLUMN location_id SET NOT NULL;
      `, { transaction });

      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uniq_invitem_loc_prod_variant_lot_serial'
              AND conrelid = 'inventory_items'::regclass
          ) THEN
            ALTER TABLE inventory_items
            ADD CONSTRAINT uniq_invitem_loc_prod_variant_lot_serial
            UNIQUE (location_id, product_id, variant_id, lot_id, serial_id);
          END IF;
        END $$;
      `, { transaction });

      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS inventory_items_stock_key_uniq;
      `, { transaction });

      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS inventory_items_company_warehouse_product_variant_idx;
      `, { transaction });

      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS inventory_items_company_warehouse_location_idx;
      `, { transaction });
    });
  },
};

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

async function assertNoNormalizedDuplicates(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(`
    SELECT
      company_id,
      warehouse_id,
      COALESCE(location_id, '${ZERO_UUID}'::uuid) AS location_key,
      product_id,
      COALESCE(variant_id, '${ZERO_UUID}'::uuid) AS variant_key,
      COALESCE(lot_id, '${ZERO_UUID}'::uuid) AS lot_key,
      COALESCE(serial_id, '${ZERO_UUID}'::uuid) AS serial_key,
      COUNT(*)::int AS duplicate_count,
      (ARRAY_AGG(id::text ORDER BY id::text))[1:10] AS sample_ids
    FROM inventory_items
    GROUP BY
      company_id,
      warehouse_id,
      COALESCE(location_id, '${ZERO_UUID}'::uuid),
      product_id,
      COALESCE(variant_id, '${ZERO_UUID}'::uuid),
      COALESCE(lot_id, '${ZERO_UUID}'::uuid),
      COALESCE(serial_id, '${ZERO_UUID}'::uuid)
    HAVING COUNT(*) > 1
    LIMIT 10;
  `, { transaction });

  if (rows.length) {
    throw new Error(
      'Cannot apply WMS-POLICY-2A: duplicate normalized inventory stock keys exist. ' +
      'Resolve duplicates manually before adding inventory_items_stock_key_uniq. ' +
      `Examples: ${JSON.stringify(rows)}`
    );
  }
}
