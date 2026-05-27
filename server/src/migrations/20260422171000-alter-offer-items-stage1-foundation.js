'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'offer_items';
    const table = await queryInterface.describeTable(tableName);

    const addColumnIfMissing = async (columnName, definition) => {
      if (!table[columnName]) {
        await queryInterface.addColumn(tableName, columnName, definition);
      }
    };

    await addColumnIfMissing('company_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await addColumnIfMissing('product_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'products', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('sort_order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('sku_snapshot', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await addColumnIfMissing('description_snapshot', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('unit_snapshot', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await addColumnIfMissing('vat_rate_snapshot', {
      type: Sequelize.DECIMAL(7, 4),
      allowNull: true,
    });
    await addColumnIfMissing('product_type_snapshot', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await addColumnIfMissing('metadata_snapshot', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await addColumnIfMissing('discount_type', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'none',
    });
    await addColumnIfMissing('discount_value', {
      type: Sequelize.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('line_subtotal_net', {
      type: Sequelize.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('line_vat', {
      type: Sequelize.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('line_total_gross', {
      type: Sequelize.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('is_custom_line', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing('notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    const current = await queryInterface.describeTable(tableName);
    if (current.variant_id) {
      await queryInterface.changeColumn(tableName, 'variant_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'product_variants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE offer_items oi
      SET company_id = o.company_id
      FROM offers o
      WHERE oi.offer_id = o.id
        AND oi.company_id IS NULL
    `);

    const afterBackfill = await queryInterface.describeTable(tableName);
    if (afterBackfill.company_id) {
      await queryInterface.changeColumn(tableName, 'company_id', {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }

    try {
      await queryInterface.removeConstraint(tableName, 'offer_items_unique_offer_variant_sku');
    } catch (_error) {
      // noop
    }

    const indexes = await queryInterface.showIndex(tableName);
    const hasIndex = (name) => indexes.some((idx) => idx.name === name);

    if (!hasIndex('offer_items_company_offer_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'offer_id'], {
        name: 'offer_items_company_offer_idx',
      });
    }
    if (!hasIndex('offer_items_company_product_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'product_id'], {
        name: 'offer_items_company_product_idx',
      });
    }
    if (!hasIndex('offer_items_company_offer_sort_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'offer_id', 'sort_order'], {
        name: 'offer_items_company_offer_sort_idx',
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'offer_items';
    const indexesToDrop = [
      'offer_items_company_offer_idx',
      'offer_items_company_product_idx',
      'offer_items_company_offer_sort_idx',
    ];
    for (const indexName of indexesToDrop) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.removeIndex(tableName, indexName);
      } catch (_error) {
        // noop
      }
    }
  },
};

