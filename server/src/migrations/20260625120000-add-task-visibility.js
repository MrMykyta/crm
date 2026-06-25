'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable('tasks');

      if (!table.visibility) {
        await queryInterface.addColumn('tasks', 'visibility', {
          type: Sequelize.ENUM('private', 'company', 'department'),
          allowNull: false,
          defaultValue: 'company',
        }, { transaction });
      }

      if (!table.visibility_department_id) {
        await queryInterface.addColumn('tasks', 'visibility_department_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'company_departments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }, { transaction });
      }

      await queryInterface.sequelize.query(`
        UPDATE tasks
        SET visibility = 'company'
        WHERE visibility IS NULL
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS tasks_company_visibility_idx
        ON tasks (company_id, visibility)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS tasks_company_visibility_department_idx
        ON tasks (company_id, visibility_department_id)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS tasks_company_created_by_idx
        ON tasks (company_id, created_by)
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS tasks_company_created_by_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS tasks_company_visibility_department_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS tasks_company_visibility_idx', { transaction });

      const table = await queryInterface.describeTable('tasks');
      if (table.visibility_department_id) {
        await queryInterface.removeColumn('tasks', 'visibility_department_id', { transaction });
      }
      if (table.visibility) {
        await queryInterface.removeColumn('tasks', 'visibility', { transaction });
      }

      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_visibility"', { transaction });
    });
  },
};
