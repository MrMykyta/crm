'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable('counterparties');

      if (!table.registry_verified) {
        await queryInterface.addColumn('counterparties', 'registry_verified', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }, { transaction });
      }

      if (!table.registry_verified_at) {
        await queryInterface.addColumn('counterparties', 'registry_verified_at', {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }

      if (!table.registry_verified_source) {
        await queryInterface.addColumn('counterparties', 'registry_verified_source', {
          type: Sequelize.STRING(128),
          allowNull: true,
        }, { transaction });
      }

      if (!table.registry_verified_env) {
        await queryInterface.addColumn('counterparties', 'registry_verified_env', {
          type: Sequelize.STRING(32),
          allowNull: true,
        }, { transaction });
      }

      if (!table.registry_verified_mock) {
        await queryInterface.addColumn('counterparties', 'registry_verified_mock', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }, { transaction });
      }

      if (!table.registry_snapshot) {
        await queryInterface.addColumn('counterparties', 'registry_snapshot', {
          type: Sequelize.JSONB,
          allowNull: true,
        }, { transaction });
      }

      if (!table.registry_snapshot_hash) {
        await queryInterface.addColumn('counterparties', 'registry_snapshot_hash', {
          type: Sequelize.STRING(64),
          allowNull: true,
        }, { transaction });
      }

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS counterparties_registry_verified_idx
        ON counterparties (company_id, registry_verified)
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS counterparties_registry_verified_idx', { transaction });
      const table = await queryInterface.describeTable('counterparties');

      if (table.registry_snapshot_hash) {
        await queryInterface.removeColumn('counterparties', 'registry_snapshot_hash', { transaction });
      }
      if (table.registry_snapshot) {
        await queryInterface.removeColumn('counterparties', 'registry_snapshot', { transaction });
      }
      if (table.registry_verified_mock) {
        await queryInterface.removeColumn('counterparties', 'registry_verified_mock', { transaction });
      }
      if (table.registry_verified_env) {
        await queryInterface.removeColumn('counterparties', 'registry_verified_env', { transaction });
      }
      if (table.registry_verified_source) {
        await queryInterface.removeColumn('counterparties', 'registry_verified_source', { transaction });
      }
      if (table.registry_verified_at) {
        await queryInterface.removeColumn('counterparties', 'registry_verified_at', { transaction });
      }
      if (table.registry_verified) {
        await queryInterface.removeColumn('counterparties', 'registry_verified', { transaction });
      }
    });
  },
};
