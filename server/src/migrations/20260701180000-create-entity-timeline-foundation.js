'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name = typeof table === 'string' ? table : table?.tableName;
    return name === tableName;
  });
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
    if (!(await tableExists(queryInterface, 'entity_timeline_events'))) {
      await queryInterface.createTable('entity_timeline_events', {
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
        entity_type: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        entity_id: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        event_type: {
          type: Sequelize.STRING(128),
          allowNull: false,
        },
        event_category: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'system',
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        summary: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        actor_user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        actor_name_snapshot: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        source_module: {
          type: Sequelize.STRING(32),
          allowNull: true,
        },
        source_entity_type: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        source_entity_id: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        related_entity_type: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        related_entity_id: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        parent_event_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'entity_timeline_events', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        correlation_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        request_id: {
          type: Sequelize.STRING(128),
          allowNull: true,
        },
        changes: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        payload: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        visibility: {
          type: Sequelize.STRING(24),
          allowNull: false,
          defaultValue: 'company',
        },
        severity: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: 'info',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    if (!(await tableExists(queryInterface, 'entity_timeline_links'))) {
      await queryInterface.createTable('entity_timeline_links', {
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
        timeline_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'entity_timeline_events', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        entity_type: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        entity_id: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        role: {
          type: Sequelize.STRING(24),
          allowNull: false,
          defaultValue: 'related',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    await addIndexIfMissing(queryInterface, 'entity_timeline_events', ['company_id', 'entity_type', 'entity_id', 'created_at'], 'idx_entity_timeline_events_primary_entity_created');
    await addIndexIfMissing(queryInterface, 'entity_timeline_events', ['company_id', 'event_category', 'created_at'], 'idx_entity_timeline_events_category_created');
    await addIndexIfMissing(queryInterface, 'entity_timeline_events', ['company_id', 'event_type', 'created_at'], 'idx_entity_timeline_events_type_created');
    await addIndexIfMissing(queryInterface, 'entity_timeline_events', ['correlation_id'], 'idx_entity_timeline_events_correlation_id');
    await addIndexIfMissing(queryInterface, 'entity_timeline_links', ['company_id', 'entity_type', 'entity_id', 'created_at'], 'idx_entity_timeline_links_entity_created');
    await addIndexIfMissing(queryInterface, 'entity_timeline_links', ['timeline_event_id'], 'idx_entity_timeline_links_event_id');
  },

  async down(queryInterface) {
    await removeIndexIfExists(queryInterface, 'entity_timeline_links', 'idx_entity_timeline_links_event_id');
    await removeIndexIfExists(queryInterface, 'entity_timeline_links', 'idx_entity_timeline_links_entity_created');
    await removeIndexIfExists(queryInterface, 'entity_timeline_events', 'idx_entity_timeline_events_correlation_id');
    await removeIndexIfExists(queryInterface, 'entity_timeline_events', 'idx_entity_timeline_events_type_created');
    await removeIndexIfExists(queryInterface, 'entity_timeline_events', 'idx_entity_timeline_events_category_created');
    await removeIndexIfExists(queryInterface, 'entity_timeline_events', 'idx_entity_timeline_events_primary_entity_created');
    await queryInterface.dropTable('entity_timeline_links');
    await queryInterface.dropTable('entity_timeline_events');
  },
};
