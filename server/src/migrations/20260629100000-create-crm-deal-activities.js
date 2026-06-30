'use strict';

const TABLE = 'crm_deal_activities';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    if (typeof table === 'string') return table === tableName;
    return table.tableName === tableName;
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
    if (!(await tableExists(queryInterface, TABLE))) {
      await queryInterface.createTable(TABLE, {
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
        deal_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'deals', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        type: {
          type: Sequelize.STRING(40),
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        body: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        occurred_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        author_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
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
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await addIndexIfMissing(queryInterface, TABLE, ['company_id', 'deal_id', 'occurred_at'], 'idx_crm_deal_activities_company_deal_occurred');
    await addIndexIfMissing(queryInterface, TABLE, ['company_id', 'type'], 'idx_crm_deal_activities_company_type');
    await addIndexIfMissing(queryInterface, TABLE, ['deal_id'], 'idx_crm_deal_activities_deal');
    await addIndexIfMissing(queryInterface, TABLE, ['author_id'], 'idx_crm_deal_activities_author');
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, TABLE))) return;

    await removeIndexIfExists(queryInterface, TABLE, 'idx_crm_deal_activities_author');
    await removeIndexIfExists(queryInterface, TABLE, 'idx_crm_deal_activities_deal');
    await removeIndexIfExists(queryInterface, TABLE, 'idx_crm_deal_activities_company_type');
    await removeIndexIfExists(queryInterface, TABLE, 'idx_crm_deal_activities_company_deal_occurred');
    await queryInterface.dropTable(TABLE);
  },
};
