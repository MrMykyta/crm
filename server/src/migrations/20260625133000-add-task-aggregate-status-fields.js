'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tasks = await queryInterface.describeTable('tasks');
      const participants = await queryInterface.describeTable('task_user_participants');

      if (!tasks.completed_at) {
        await queryInterface.addColumn('tasks', 'completed_at', {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }

      if (!tasks.completed_by_id) {
        await queryInterface.addColumn('tasks', 'completed_by_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }, { transaction });
      }

      if (!participants.started_at) {
        await queryInterface.addColumn('task_user_participants', 'started_at', {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }

      if (!participants.completed_at) {
        await queryInterface.addColumn('task_user_participants', 'completed_at', {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }

      if (!participants.completed_by_id) {
        await queryInterface.addColumn('task_user_participants', 'completed_by_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }, { transaction });
      }

      if (!participants.status_note) {
        await queryInterface.addColumn('task_user_participants', 'status_note', {
          type: Sequelize.TEXT,
          allowNull: true,
        }, { transaction });
      }

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS tasks_company_completed_at_idx
        ON tasks (company_id, completed_at)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS tasks_completed_by_idx
        ON tasks (completed_by_id)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS task_user_participants_completed_by_idx
        ON task_user_participants (completed_by_id)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS task_user_participants_completed_at_idx
        ON task_user_participants (completed_at)
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS task_user_participants_completed_at_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS task_user_participants_completed_by_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS tasks_completed_by_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS tasks_company_completed_at_idx', { transaction });

      const tasks = await queryInterface.describeTable('tasks');
      const participants = await queryInterface.describeTable('task_user_participants');

      if (participants.status_note) {
        await queryInterface.removeColumn('task_user_participants', 'status_note', { transaction });
      }
      if (participants.completed_by_id) {
        await queryInterface.removeColumn('task_user_participants', 'completed_by_id', { transaction });
      }
      if (participants.completed_at) {
        await queryInterface.removeColumn('task_user_participants', 'completed_at', { transaction });
      }
      if (participants.started_at) {
        await queryInterface.removeColumn('task_user_participants', 'started_at', { transaction });
      }

      if (tasks.completed_by_id) {
        await queryInterface.removeColumn('tasks', 'completed_by_id', { transaction });
      }
      if (tasks.completed_at) {
        await queryInterface.removeColumn('tasks', 'completed_at', { transaction });
      }
    });
  },
};
