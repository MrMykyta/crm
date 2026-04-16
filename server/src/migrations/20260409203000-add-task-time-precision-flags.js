'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks', 'planned_start_has_time', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('tasks', 'planned_end_has_time', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('tasks', 'actual_start_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('tasks', 'actual_end_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('tasks', 'actual_start_has_time', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('tasks', 'actual_end_has_time', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE tasks
      SET
        planned_start_has_time = CASE
          WHEN start_at IS NULL THEN true
          WHEN EXTRACT(HOUR FROM start_at AT TIME ZONE 'UTC') = 0
           AND EXTRACT(MINUTE FROM start_at AT TIME ZONE 'UTC') = 0
           AND FLOOR(EXTRACT(SECOND FROM start_at AT TIME ZONE 'UTC')) = 0
          THEN false
          ELSE true
        END,
        planned_end_has_time = CASE
          WHEN end_at IS NULL THEN true
          WHEN EXTRACT(HOUR FROM end_at AT TIME ZONE 'UTC') = 0
           AND EXTRACT(MINUTE FROM end_at AT TIME ZONE 'UTC') = 0
           AND FLOOR(EXTRACT(SECOND FROM end_at AT TIME ZONE 'UTC')) = 0
          THEN false
          ELSE true
        END
    `);

    await queryInterface.addIndex('tasks', ['company_id', 'actual_start_at'], {
      name: 'tasks_company_actual_start_idx',
    });
    await queryInterface.addIndex('tasks', ['company_id', 'actual_end_at'], {
      name: 'tasks_company_actual_end_idx',
    });
  },

    // Откатывает изменения, внесённые в up().
async down(queryInterface) {
    await queryInterface.removeIndex('tasks', 'tasks_company_actual_end_idx');
    await queryInterface.removeIndex('tasks', 'tasks_company_actual_start_idx');

    await queryInterface.removeColumn('tasks', 'actual_end_has_time');
    await queryInterface.removeColumn('tasks', 'actual_start_has_time');
    await queryInterface.removeColumn('tasks', 'actual_end_at');
    await queryInterface.removeColumn('tasks', 'actual_start_at');
    await queryInterface.removeColumn('tasks', 'planned_end_has_time');
    await queryInterface.removeColumn('tasks', 'planned_start_has_time');
  },
};


