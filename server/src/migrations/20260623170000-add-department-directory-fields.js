'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable('company_departments');

      if (!table.code) {
        await queryInterface.addColumn('company_departments', 'code', {
          type: Sequelize.STRING(32),
          allowNull: true,
        }, { transaction });
      }

      if (!table.is_active) {
        await queryInterface.addColumn('company_departments', 'is_active', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        }, { transaction });
      }

      if (!table.deleted_at) {
        await queryInterface.addColumn('company_departments', 'deleted_at', {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }

      await queryInterface.sequelize.query(`
        UPDATE company_departments
        SET code = LEFT(
          LOWER(
            REGEXP_REPLACE(
              REGEXP_REPLACE(COALESCE(NULLIF(TRIM(name), ''), LEFT(id::text, 8)), '[^a-zA-Z0-9]+', '-', 'g'),
              '(^-|-$)',
              '',
              'g'
            )
          ) || '-' || LEFT(id::text, 8),
          32
        )
        WHERE code IS NULL OR TRIM(code) = ''
      `, { transaction });

      await queryInterface.changeColumn('company_departments', 'code', {
        type: Sequelize.STRING(32),
        allowNull: false,
      }, { transaction });

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS company_departments_company_code_uq
        ON company_departments (company_id, code)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS company_departments_company_active_idx
        ON company_departments (company_id, is_active, deleted_at)
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS company_departments_company_active_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS company_departments_company_code_uq', { transaction });
      const table = await queryInterface.describeTable('company_departments');
      if (table.deleted_at) await queryInterface.removeColumn('company_departments', 'deleted_at', { transaction });
      if (table.is_active) await queryInterface.removeColumn('company_departments', 'is_active', { transaction });
      if (table.code) await queryInterface.removeColumn('company_departments', 'code', { transaction });
    });
  },
};
