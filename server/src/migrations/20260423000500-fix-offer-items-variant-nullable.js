'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'offer_items';
    let table;

    try {
      table = await queryInterface.describeTable(tableName);
    } catch (_error) {
      return;
    }

    if (!table?.variant_id) return;

    const [variantFkRows] = await queryInterface.sequelize.query(
      `
        SELECT DISTINCT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f'
          AND n.nspname = current_schema()
          AND t.relname = :tableName
          AND a.attname = 'variant_id'
      `,
      { replacements: { tableName } }
    );

    for (const row of variantFkRows || []) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.removeConstraint(tableName, row.conname);
      } catch (_error) {
        // noop
      }
    }

    await queryInterface.changeColumn(tableName, 'variant_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    const [hasCanonicalFk] = await queryInterface.sequelize.query(
      `
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.conname = 'offer_items_variant_id_fkey'
          AND n.nspname = current_schema()
          AND t.relname = :tableName
        LIMIT 1
      `,
      { replacements: { tableName } }
    );

    if (!Array.isArray(hasCanonicalFk) || hasCanonicalFk.length === 0) {
      await queryInterface.addConstraint(tableName, {
        fields: ['variant_id'],
        type: 'foreign key',
        name: 'offer_items_variant_id_fkey',
        references: {
          table: 'product_variants',
          field: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down() {
    // intentionally noop: reverting may fail if rows with NULL variant_id already exist
  },
};

