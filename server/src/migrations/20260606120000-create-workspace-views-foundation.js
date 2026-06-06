'use strict';

const { Op } = require('sequelize');

const ENUM_SCOPE = 'workspace_view_scope';
const SCOPE_CHECK = 'workspace_views_scope_chk';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    // 1) ENUM workspace_view_scope ('system','personal') — idempotent.
    await sequelize.query(
      `DO $$ BEGIN
        CREATE TYPE "${ENUM_SCOPE}" AS ENUM ('system', 'personal');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
    );

    // 2) workspace_views.
    if (!(await hasTable(queryInterface, 'workspace_views'))) {
      await queryInterface.createTable('workspace_views', {
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
        module: { type: Sequelize.STRING(64), allowNull: false },
        key: { type: Sequelize.STRING(64), allowNull: true },
        scope: {
          type: `"${ENUM_SCOPE}"`,
          allowNull: false,
          defaultValue: 'personal',
        },
        owner_user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        name: { type: Sequelize.STRING(120), allowNull: false },
        name_i18n_key: { type: Sequelize.STRING(120), allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        icon: { type: Sequelize.STRING(40), allowNull: true },
        filter: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        sort: { type: Sequelize.JSONB, allowNull: true },
        columns: { type: Sequelize.JSONB, allowNull: true },
        view_type: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'list' },
        is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_locked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
    }

    // 3) workspace_view_user_prefs.
    if (!(await hasTable(queryInterface, 'workspace_view_user_prefs'))) {
      await queryInterface.createTable('workspace_view_user_prefs', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        view_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'workspace_views', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        pinned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        hidden: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        last_used_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
    }

    // 4) CHECK constraint: scope/owner/key consistency (§11.1 §2.2/§3).
    if (!(await hasConstraint(queryInterface, SCOPE_CHECK))) {
      await sequelize.query(
        `ALTER TABLE workspace_views ADD CONSTRAINT "${SCOPE_CHECK}" CHECK (
          (scope = 'system'   AND owner_user_id IS NULL     AND key IS NOT NULL) OR
          (scope = 'personal' AND owner_user_id IS NOT NULL AND key IS NULL)
        )`
      );
    }

    // 5) Indexes — workspace_views.
    await addIndexIfMissing(queryInterface, 'workspace_views', ['company_id', 'module', 'key'], {
      unique: true,
      name: 'workspace_views_system_uniq',
      where: { key: { [Op.ne]: null } },
    });
    await addIndexIfMissing(queryInterface, 'workspace_views', ['company_id', 'module'], {
      unique: true,
      name: 'workspace_views_default_uniq',
      where: { is_default: true },
    });
    await addIndexIfMissing(queryInterface, 'workspace_views', ['company_id', 'module'], {
      name: 'workspace_views_company_module_idx',
    });
    await addIndexIfMissing(queryInterface, 'workspace_views', ['owner_user_id', 'module'], {
      name: 'workspace_views_owner_module_idx',
    });
    await addIndexIfMissing(queryInterface, 'workspace_views', ['scope'], {
      name: 'workspace_views_scope_idx',
    });

    // 6) Indexes — workspace_view_user_prefs.
    await addIndexIfMissing(queryInterface, 'workspace_view_user_prefs', ['user_id', 'view_id'], {
      unique: true,
      name: 'workspace_view_user_prefs_user_view_uniq',
    });
    await addIndexIfMissing(queryInterface, 'workspace_view_user_prefs', ['view_id'], {
      name: 'workspace_view_user_prefs_view_idx',
    });
    await addIndexIfMissing(
      queryInterface,
      'workspace_view_user_prefs',
      ['user_id', 'last_used_at'],
      {
        name: 'workspace_view_user_prefs_recent_idx',
        where: { last_used_at: { [Op.ne]: null } },
      }
    );
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // DROP TABLE cascades indexes/constraints/FKs on this table.
    await dropTableIfExists(queryInterface, 'workspace_view_user_prefs');
    await dropTableIfExists(queryInterface, 'workspace_views');

    await sequelize.query(`DROP TYPE IF EXISTS "${ENUM_SCOPE}"`);
  },
};

async function hasTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((t) => (typeof t === 'string' ? t === tableName : t.tableName === tableName));
}

async function dropTableIfExists(queryInterface, tableName) {
  if (await hasTable(queryInterface, tableName)) {
    await queryInterface.dropTable(tableName);
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

async function hasConstraint(queryInterface, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT 1 FROM pg_constraint WHERE conname = :n LIMIT 1',
    { replacements: { n: constraintName } }
  );
  return rows.length > 0;
}
