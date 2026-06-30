'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
}

async function addColumnIfMissing(queryInterface, Sequelize, tableName, columnName, definition) {
  if (!(await columnExists(queryInterface, tableName, columnName))) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function removeColumnIfExists(queryInterface, tableName, columnName) {
  if (await columnExists(queryInterface, tableName, columnName)) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

async function addIndexIfMissing(queryInterface, tableName, fields, name) {
  const indexes = await queryInterface.showIndex(tableName).catch(() => []);
  if (!indexes.some((index) => index.name === name)) {
    await queryInterface.addIndex(tableName, fields, { name });
  }
}

async function removeIndexIfExists(queryInterface, tableName, name) {
  const indexes = await queryInterface.showIndex(tableName).catch(() => []);
  if (indexes.some((index) => index.name === name)) {
    await queryInterface.removeIndex(tableName, name);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'contact_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'contacts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'expected_close_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'closed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'lost_reason_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'crm_deal_lost_reasons', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'lost_note', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'priority', {
      type: Sequelize.SMALLINT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'source', {
      type: Sequelize.STRING(80),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'probability', {
      type: Sequelize.SMALLINT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'next_action_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'next_action_type', {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'next_action_task_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'tasks', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'health_status', {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'health_computed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'deals', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE deals
      SET stage_entered_at = COALESCE(stage_entered_at, updated_at, created_at)
      WHERE stage_id IS NOT NULL
        AND stage_entered_at IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE deals
      SET closed_at = COALESCE(closed_at, updated_at)
      WHERE status IN ('won', 'lost')
        AND closed_at IS NULL
    `);

    await addIndexIfMissing(queryInterface, 'deals', ['company_id', 'pipeline_id', 'stage_id'], 'idx_deals_company_pipeline_stage');
    await addIndexIfMissing(queryInterface, 'deals', ['expected_close_date'], 'idx_deals_expected_close_date');
    await addIndexIfMissing(queryInterface, 'deals', ['next_action_at'], 'idx_deals_next_action_at');
    await addIndexIfMissing(queryInterface, 'deals', ['stage_entered_at'], 'idx_deals_stage_entered_at');
    await addIndexIfMissing(queryInterface, 'deals', ['health_status'], 'idx_deals_health_status');
  },

  async down(queryInterface) {
    await removeIndexIfExists(queryInterface, 'deals', 'idx_deals_health_status');
    await removeIndexIfExists(queryInterface, 'deals', 'idx_deals_stage_entered_at');
    await removeIndexIfExists(queryInterface, 'deals', 'idx_deals_next_action_at');
    await removeIndexIfExists(queryInterface, 'deals', 'idx_deals_expected_close_date');
    await removeIndexIfExists(queryInterface, 'deals', 'idx_deals_company_pipeline_stage');

    await removeColumnIfExists(queryInterface, 'deals', 'deleted_at');
    await removeColumnIfExists(queryInterface, 'deals', 'health_computed_at');
    await removeColumnIfExists(queryInterface, 'deals', 'health_status');
    await removeColumnIfExists(queryInterface, 'deals', 'next_action_task_id');
    await removeColumnIfExists(queryInterface, 'deals', 'next_action_type');
    await removeColumnIfExists(queryInterface, 'deals', 'next_action_at');
    await removeColumnIfExists(queryInterface, 'deals', 'probability');
    await removeColumnIfExists(queryInterface, 'deals', 'source');
    await removeColumnIfExists(queryInterface, 'deals', 'priority');
    await removeColumnIfExists(queryInterface, 'deals', 'lost_note');
    await removeColumnIfExists(queryInterface, 'deals', 'lost_reason_id');
    await removeColumnIfExists(queryInterface, 'deals', 'closed_at');
    await removeColumnIfExists(queryInterface, 'deals', 'expected_close_date');
    await removeColumnIfExists(queryInterface, 'deals', 'contact_id');
  },
};
