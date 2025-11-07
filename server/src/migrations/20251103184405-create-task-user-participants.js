'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('task_user_participants', {
      id: {
        type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4,
      },
      taskId: {
        type: Sequelize.UUID, allowNull: false, field: 'task_id',
        references: { model: 'tasks', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID, allowNull: false, field: 'user_id',
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('assignee', 'watcher'),
        allowNull: false,
        defaultValue: 'assignee',
      },
      // индивидуальный статус исполнителя (для расчёта общего статуса)
      memberStatus: {
        type: Sequelize.ENUM('todo', 'in_progress', 'done', 'blocked', 'canceled'),
        allowNull: false,
        defaultValue: 'todo',
        field: 'member_status',
      },

      createdAt: { type: Sequelize.DATE, allowNull: false, field: 'created_at', defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, field: 'updated_at', defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addConstraint('task_user_participants', {
      fields: ['task_id', 'user_id', 'role'],
      type: 'unique',
      name: 'uniq_task_user_participants_triplet',
    });

    await queryInterface.addIndex('task_user_participants', ['user_id', 'task_id'], {
      name: 'task_user_participants_user_task_idx',
    });
  },

  async down(queryInterface /*, Sequelize */) {
    await queryInterface.removeIndex('task_user_participants', 'task_user_participants_user_task_idx');
    await queryInterface.removeConstraint('task_user_participants', 'uniq_task_user_participants_triplet');
    await queryInterface.dropTable('task_user_participants');
  },
};