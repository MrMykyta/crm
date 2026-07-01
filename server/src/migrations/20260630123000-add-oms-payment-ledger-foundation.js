'use strict';

async function hasTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.map((table) => (typeof table === 'string' ? table : table.tableName)).includes(tableName);
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

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  const exists = indexes.some((index) => index.name === options.name);
  if (!exists) {
    await queryInterface.addIndex(tableName, fields, options);
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_orders_payment_status')
          AND NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_orders_payment_status'
              AND e.enumlabel = 'partially_paid'
          )
        THEN
          ALTER TYPE "enum_orders_payment_status" ADD VALUE 'partially_paid';
        END IF;
      END $$;
    `);

    if (!(await hasTable(queryInterface, 'payment_applications'))) {
      await queryInterface.createTable('payment_applications', {
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
        payment_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'payments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        invoice_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'invoices', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        amount: {
          type: Sequelize.DECIMAL(14, 2),
          allowNull: false,
        },
        allocated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()'),
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
    }

    if (!(await hasTable(queryInterface, 'credit_note_applications'))) {
      await queryInterface.createTable('credit_note_applications', {
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
        credit_note_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'credit_notes', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        invoice_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'invoices', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        amount: {
          type: Sequelize.DECIMAL(14, 2),
          allowNull: false,
        },
        allocated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('NOW()'),
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
    }

    await addIndexIfMissing(queryInterface, 'payment_applications', ['company_id', 'payment_id'], {
      name: 'payment_applications_company_payment_idx',
    });
    await addIndexIfMissing(queryInterface, 'payment_applications', ['company_id', 'invoice_id'], {
      name: 'payment_applications_company_invoice_idx',
    });
    await addIndexIfMissing(queryInterface, 'payment_applications', ['payment_id'], {
      name: 'payment_applications_payment_idx',
    });
    await addIndexIfMissing(queryInterface, 'payment_applications', ['invoice_id'], {
      name: 'payment_applications_invoice_idx',
    });

    await addIndexIfMissing(queryInterface, 'credit_note_applications', ['company_id', 'credit_note_id'], {
      name: 'credit_note_applications_company_credit_note_idx',
    });
    await addIndexIfMissing(queryInterface, 'credit_note_applications', ['company_id', 'invoice_id'], {
      name: 'credit_note_applications_company_invoice_idx',
    });
    await addIndexIfMissing(queryInterface, 'credit_note_applications', ['credit_note_id'], {
      name: 'credit_note_applications_credit_note_idx',
    });
    await addIndexIfMissing(queryInterface, 'credit_note_applications', ['invoice_id'], {
      name: 'credit_note_applications_invoice_idx',
    });

    await addColumnIfMissing(queryInterface, 'payments', 'direction', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'inbound',
    });
    await addColumnIfMissing(queryInterface, 'payments', 'currency_code', {
      type: Sequelize.STRING(3),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'payments', 'reference', {
      type: Sequelize.STRING(256),
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, 'credit_notes', 'status', {
      type: Sequelize.STRING(32),
      allowNull: true,
      defaultValue: 'issued',
    });
    await addColumnIfMissing(queryInterface, 'credit_notes', 'number', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'credit_notes', 'issued_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'credit_notes', 'order_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'orders', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await addIndexIfMissing(queryInterface, 'credit_notes', ['company_id', 'order_id'], {
      name: 'credit_notes_company_order_idx',
    });

    await sequelize.query(`
      INSERT INTO payment_applications (
        id,
        company_id,
        payment_id,
        invoice_id,
        amount,
        allocated_at,
        created_at,
        updated_at
      )
      SELECT
        gen_random_uuid(),
        p.company_id,
        p.id,
        one_invoice.invoice_id,
        LEAST(p.amount, one_invoice.total_gross),
        COALESCE(p.processed_at, p.created_at, NOW()),
        NOW(),
        NOW()
      FROM payments p
      JOIN (
        SELECT
          company_id,
          order_id,
          MIN(id::text)::uuid AS invoice_id,
          MIN(total_gross) AS total_gross,
          COUNT(*) AS invoice_count
        FROM invoices
        WHERE deleted_at IS NULL
        GROUP BY company_id, order_id
        HAVING COUNT(*) = 1
      ) one_invoice ON one_invoice.company_id = p.company_id AND one_invoice.order_id = p.order_id
      WHERE p.deleted_at IS NULL
        AND p.status = 'paid'
        AND COALESCE(p.direction, 'inbound') = 'inbound'
        AND p.amount > 0
        AND NOT EXISTS (
          SELECT 1
          FROM payment_applications pa
          WHERE pa.payment_id = p.id
            AND pa.invoice_id = one_invoice.invoice_id
            AND pa.deleted_at IS NULL
        );
    `);
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'credit_notes', 'order_id');
    await removeColumnIfExists(queryInterface, 'credit_notes', 'issued_at');
    await removeColumnIfExists(queryInterface, 'credit_notes', 'number');
    await removeColumnIfExists(queryInterface, 'credit_notes', 'status');
    await removeColumnIfExists(queryInterface, 'payments', 'reference');
    await removeColumnIfExists(queryInterface, 'payments', 'currency_code');
    await removeColumnIfExists(queryInterface, 'payments', 'direction');

    if (await hasTable(queryInterface, 'credit_note_applications')) {
      await queryInterface.dropTable('credit_note_applications');
    }
    if (await hasTable(queryInterface, 'payment_applications')) {
      await queryInterface.dropTable('payment_applications');
    }
  },
};
