'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      // multitenant
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // автор
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'created_by',
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },

      // контент
      title: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(64),        // простая категория-лейбл (потом можно вынести в справочник)
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // статусы
      status: {
        type: Sequelize.ENUM('todo', 'in_progress', 'done', 'blocked', 'canceled'),
        allowNull: false,
        defaultValue: 'todo',
      },

      // приоритет 0..100
      priority: {
        type: Sequelize.SMALLINT,
        allowNull: false,
        defaultValue: 50,
      },

      // планирование (all-day = если время не задано — дата на весь день)
      startAt: {
        type: Sequelize.DATE, // timestamptz
        allowNull: true,
        field: 'start_at',
      },
      endAt: {
        type: Sequelize.DATE, // timestamptz
        allowNull: true,
        field: 'end_at',
      },
      timezone: {
        type: Sequelize.STRING(64), // 'Europe/Warsaw'
        allowNull: true,
      },

      // режимы назначения/наблюдения
      participantMode: {
        type: Sequelize.ENUM('none', 'all', 'lists'), // lists = смотрим pivot (users/departments)
        allowNull: false,
        defaultValue: 'none',
        field: 'participant_mode',
      },
      watcherMode: {
        type: Sequelize.ENUM('none', 'all', 'lists'),
        allowNull: false,
        defaultValue: 'none',
        field: 'watcher_mode',
      },

      // агрегировать общий статус по исполнителям
      statusAggregate: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'status_aggregate',
      },

      // связи CRM
      counterpartyId: {
        type: Sequelize.UUID,
        field: 'counterparty_id',
        allowNull: true,
        references: { model: 'counterparties', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      dealId: {
        type: Sequelize.UUID,
        field: 'deal_id',
        allowNull: true,
        references: { model: 'deals', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // system
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
      deletedAt: {
        type: Sequelize.DATE,
        field: 'deleted_at',
        allowNull: true,
      },
    });

    await queryInterface.addIndex('tasks', ['company_id', 'status'], { name: 'tasks_company_status_idx' });
    await queryInterface.addIndex('tasks', ['company_id', 'created_at'], { name: 'tasks_company_created_idx' });
    await queryInterface.addIndex('tasks', ['company_id', 'start_at'], { name: 'tasks_company_start_idx' });
    await queryInterface.addIndex('tasks', ['company_id', 'end_at'], { name: 'tasks_company_end_idx' });

    // partial index на активные (не done и не удалённые)
    await queryInterface.addIndex('tasks', ['company_id', 'start_at'], {
      name: 'tasks_company_active_partial_idx',
      where: {
        deleted_at: null,
        status: { [Sequelize.Op.ne]: 'done' },
      },
    });
  },

  async down(queryInterface /*, Sequelize */) {
    await queryInterface.removeIndex('tasks', 'tasks_company_active_partial_idx');
    await queryInterface.removeIndex('tasks', 'tasks_company_end_idx');
    await queryInterface.removeIndex('tasks', 'tasks_company_start_idx');
    await queryInterface.removeIndex('tasks', 'tasks_company_created_idx');
    await queryInterface.removeIndex('tasks', 'tasks_company_status_idx');
    await queryInterface.dropTable('tasks');
  },
};