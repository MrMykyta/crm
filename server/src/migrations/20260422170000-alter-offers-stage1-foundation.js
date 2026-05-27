'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'offers';
    const table = await queryInterface.describeTable(tableName);

    if (table.customer_id && !table.counterparty_id) {
      await queryInterface.renameColumn(tableName, 'customer_id', 'counterparty_id');
    }

    const refreshed = await queryInterface.describeTable(tableName);

    const addColumnIfMissing = async (columnName, definition) => {
      if (!refreshed[columnName]) {
        await queryInterface.addColumn(tableName, columnName, definition);
      }
    };

    await addColumnIfMissing('number', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await addColumnIfMissing('title', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing('subject', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnIfMissing('issue_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await addColumnIfMissing('exchange_rate', {
      type: Sequelize.DECIMAL(18, 6),
      allowNull: true,
    });
    await addColumnIfMissing('source_type', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await addColumnIfMissing('source_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await addColumnIfMissing('contact_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'contacts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('deal_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'deals', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('discount_total', {
      type: Sequelize.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('rounding_total', {
      type: Sequelize.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('items_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('lines_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing('payment_terms', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('delivery_terms', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('lead_time', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await addColumnIfMissing('incoterms', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await addColumnIfMissing('notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('internal_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('billing_address_snapshot', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await addColumnIfMissing('shipping_address_snapshot', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await addColumnIfMissing('created_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('updated_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('accepted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing('accepted_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('rejected_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing('rejected_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('sent_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing('sent_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('viewed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing('viewed_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('cancelled_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing('cancelled_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('converted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing('converted_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('converted_order_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'orders', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('last_status_changed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing('meta', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });
    await addColumnIfMissing('locked_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing('locked_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('revision', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    const afterColumns = await queryInterface.describeTable(tableName);

    if (afterColumns.status) {
      await queryInterface.changeColumn(tableName, 'status', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'draft',
      });
    }

    if (afterColumns.valid_until) {
      await queryInterface.changeColumn(tableName, 'valid_until', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (afterColumns.deletedAt && !afterColumns.deleted_at) {
      await queryInterface.renameColumn(tableName, 'deletedAt', 'deleted_at');
    }

    await queryInterface.sequelize.query(
      `UPDATE offers SET issue_date = COALESCE(issue_date, DATE(created_at)) WHERE issue_date IS NULL`
    );

    const indexes = await queryInterface.showIndex(tableName);
    const hasIndex = (name) => indexes.some((idx) => idx.name === name);

    if (!hasIndex('offers_company_number_uniq')) {
      await queryInterface.addIndex(tableName, ['company_id', 'number'], {
        name: 'offers_company_number_uniq',
        unique: true,
      });
    }
    if (!hasIndex('offers_company_counterparty_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'counterparty_id'], {
        name: 'offers_company_counterparty_idx',
      });
    }
    if (!hasIndex('offers_company_owner_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'owner_id'], {
        name: 'offers_company_owner_idx',
      });
    }
    if (!hasIndex('offers_company_issue_date_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'issue_date'], {
        name: 'offers_company_issue_date_idx',
      });
    }
    if (!hasIndex('offers_company_valid_until_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'valid_until'], {
        name: 'offers_company_valid_until_idx',
      });
    }
    if (!hasIndex('offers_company_updated_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'updated_at'], {
        name: 'offers_company_updated_idx',
      });
    }
    if (!hasIndex('offers_company_converted_order_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'converted_order_id'], {
        name: 'offers_company_converted_order_idx',
      });
    }

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_offers_status')
           AND NOT EXISTS (
             SELECT 1
             FROM pg_attribute a
             JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_type t ON t.oid = a.atttypid
             WHERE t.typname = 'enum_offers_status'
               AND c.relkind = 'r'
               AND a.attnum > 0
               AND NOT a.attisdropped
           )
           AND NOT EXISTS (
             SELECT 1
             FROM pg_attrdef d
             JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
             JOIN pg_class c ON c.oid = d.adrelid
             WHERE pg_get_expr(d.adbin, d.adrelid) LIKE '%enum_offers_status%'
               AND c.relkind = 'r'
               AND a.attnum > 0
               AND NOT a.attisdropped
           )
        THEN
          DROP TYPE "enum_offers_status";
        END IF;
      END
      $$;
    `);
  },

  async down(queryInterface) {
    const tableName = 'offers';
    const indexesToDrop = [
      'offers_company_number_uniq',
      'offers_company_counterparty_idx',
      'offers_company_owner_idx',
      'offers_company_issue_date_idx',
      'offers_company_valid_until_idx',
      'offers_company_updated_idx',
      'offers_company_converted_order_idx',
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
