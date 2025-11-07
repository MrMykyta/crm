'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('task_department_participants', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      taskId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'task_id',
        references: { model: 'tasks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      departmentId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'department_id',
        // ВАЖНО: правильное имя таблицы
        references: { model: 'company_departments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // роль внутри задачи (пока используем только 'assignee', но поле оставим на будущее)
      role: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'created_at',
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'updated_at',
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Один департамент не должен дублироваться в задаче
    await queryInterface.addConstraint('task_department_participants', {
      fields: ['task_id', 'department_id'],
      type: 'unique',
      name: 'uniq_task_department_participant',
    });

    await queryInterface.addIndex('task_department_participants', ['department_id', 'task_id'], {
      name: 'tdp_department_task_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('task_department_participants', 'tdp_department_task_idx');
    await queryInterface.removeConstraint('task_department_participants', 'uniq_task_department_participant');
    await queryInterface.dropTable('task_department_participants');
  },
};