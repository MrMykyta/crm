'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('roles', 'slug', {
        type: Sequelize.STRING(64),
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('roles', 'is_system', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }, { transaction });

      await queryInterface.addColumn('roles', 'is_default', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE roles
        SET
          slug = COALESCE(slug, LOWER(TRIM(name))),
          is_system = CASE
            WHEN LOWER(TRIM(name)) IN ('owner', 'admin') THEN TRUE
            ELSE is_system
          END,
          is_default = CASE
            WHEN LOWER(TRIM(name)) IN (
              'owner',
              'admin',
              'manager',
              'employee',
              'user',
              'viewer',
              'sales',
              'operations',
              'accountant'
            ) THEN TRUE
            ELSE is_default
          END,
          updated_at = NOW()
        WHERE LOWER(TRIM(name)) IN (
          'owner',
          'admin',
          'manager',
          'employee',
          'user',
          'viewer',
          'sales',
          'operations',
          'accountant'
        )
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS roles_company_slug_idx
        ON roles (company_id, slug)
        WHERE slug IS NOT NULL
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS roles_company_slug_idx', { transaction });
      await queryInterface.removeColumn('roles', 'is_default', { transaction });
      await queryInterface.removeColumn('roles', 'is_system', { transaction });
      await queryInterface.removeColumn('roles', 'slug', { transaction });
    });
  },
};
