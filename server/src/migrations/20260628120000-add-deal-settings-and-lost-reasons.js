'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.map((name) => (typeof name === 'object' ? name.tableName || name.table_name : name)).includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'crm_deal_settings'))) {
      await queryInterface.createTable('crm_deal_settings', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
        },
        company_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'companies', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        probability_mode: {
          type: Sequelize.STRING(24),
          allowNull: false,
          defaultValue: 'automatic',
        },
        default_currency: {
          type: Sequelize.STRING(8),
          allowNull: false,
          defaultValue: 'PLN',
        },
        default_expected_close_days: {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 30,
        },
        visibility: {
          type: Sequelize.STRING(24),
          allowNull: false,
          defaultValue: 'company',
        },
        deal_numbering_enabled: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        deal_number_prefix: {
          type: Sequelize.STRING(32),
          allowNull: true,
          defaultValue: 'DL',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now'),
        },
      });
    }

    if (!(await tableExists(queryInterface, 'crm_deal_lost_reasons'))) {
      await queryInterface.createTable('crm_deal_lost_reasons', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
        },
        company_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'companies', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        name: {
          type: Sequelize.STRING(160),
          allowNull: false,
        },
        order: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        archived: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now'),
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await queryInterface.addIndex('crm_deal_settings', ['company_id'], {
      name: 'uniq_crm_deal_settings_company',
      unique: true,
    }).catch(() => {});
    await queryInterface.addIndex('crm_deal_lost_reasons', ['company_id', 'order'], {
      name: 'idx_crm_deal_lost_reasons_company_order',
    }).catch(() => {});
    await queryInterface.addIndex('crm_deal_lost_reasons', ['company_id', 'archived'], {
      name: 'idx_crm_deal_lost_reasons_company_archived',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('crm_deal_lost_reasons', 'idx_crm_deal_lost_reasons_company_archived').catch(() => {});
    await queryInterface.removeIndex('crm_deal_lost_reasons', 'idx_crm_deal_lost_reasons_company_order').catch(() => {});
    await queryInterface.removeIndex('crm_deal_settings', 'uniq_crm_deal_settings_company').catch(() => {});
    if (await tableExists(queryInterface, 'crm_deal_lost_reasons')) {
      await queryInterface.dropTable('crm_deal_lost_reasons');
    }
    if (await tableExists(queryInterface, 'crm_deal_settings')) {
      await queryInterface.dropTable('crm_deal_settings');
    }
  },
};
