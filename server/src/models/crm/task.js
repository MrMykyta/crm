'use strict';
const { Model } = require('sequelize');

// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
        // Описывает associations этой модели с другими сущностями.
static associate(models) {
      Task.belongsTo(models.Company, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'company',
      });
      Task.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', field: 'created_by' },
        as: 'creator',
      });
      Task.belongsTo(models.User, {
        foreignKey: { name: 'completedById', field: 'completed_by_id' },
        as: 'completedBy',
      });

      Task.belongsTo(models.Counterparty, {
        foreignKey: { name: 'counterpartyId', field: 'counterparty_id' },
        as: 'counterparty',
      });

      Task.belongsTo(models.Deal, {
        foreignKey: { name: 'dealId', field: 'deal_id' },
        as: 'deal',
      });

      Task.belongsTo(models.CompanyDepartment, {
        foreignKey: { name: 'visibilityDepartmentId', field: 'visibility_department_id' },
        as: 'visibilityDepartment',
      });

      // пользователи-участники (исполнители/наблюдатели)
      Task.belongsToMany(models.User, {
        as: 'userParticipants',
        through: models.TaskUserParticipant,
        foreignKey: { name: 'taskId', field: 'task_id' },
        otherKey:   { name: 'userId', field: 'user_id' },
      });

      // отделы-участники
      Task.belongsToMany(models.CompanyDepartment, {
        as: 'departmentParticipants',
        through: models.TaskDepartmentParticipant,
        foreignKey: { name: 'taskId', field: 'task_id' },
        otherKey:   { name: 'departmentId', field: 'department_id' },
      });

      // контактные лица
      Task.belongsToMany(models.Contact, {
        as: 'contacts',
        through: models.TaskContact,
        foreignKey: { name: 'taskId', field: 'task_id' },
        otherKey:   { name: 'contactId', field: 'contact_id' },
      });
    }

    // Вычисляет признак "весь день", когда обе даты заданы без времени.
get isAllDay() {
      return !!(
        this.startAt &&
        this.endAt &&
        this.plannedStartHasTime === false &&
        this.plannedEndHasTime === false
      );
    }
  }

  Task.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },

      companyId:     { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
      createdBy:     { type: DataTypes.UUID, allowNull: false, field: 'created_by' },

      title:         { type: DataTypes.STRING(300), allowNull: false },
      category:      { type: DataTypes.STRING(64), allowNull: true },
      description:   { type: DataTypes.TEXT, allowNull: true },

      status: {
        type: DataTypes.ENUM('todo', 'in_progress', 'done', 'blocked', 'canceled'),
        allowNull: false,
        defaultValue: 'todo',
      },

      priority: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 50,
        validate: { min: 0, max: 100 },
      },

      visibility: {
        type: DataTypes.ENUM('private', 'company', 'department'),
        allowNull: false,
        defaultValue: 'company',
      },
      visibilityDepartmentId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'visibility_department_id',
      },

      startAt:   { type: DataTypes.DATE, allowNull: true, field: 'start_at' },
      endAt:     { type: DataTypes.DATE, allowNull: true, field: 'end_at' },
      actualStartAt: { type: DataTypes.DATE, allowNull: true, field: 'actual_start_at' },
      actualEndAt: { type: DataTypes.DATE, allowNull: true, field: 'actual_end_at' },
      plannedStartHasTime: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'planned_start_has_time',
      },
      plannedEndHasTime: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'planned_end_has_time',
      },
      actualStartHasTime: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'actual_start_has_time',
      },
      actualEndHasTime: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'actual_end_has_time',
      },
      timezone:  { type: DataTypes.STRING(64), allowNull: true },

      participantMode: {
        type: DataTypes.ENUM('none', 'all', 'lists'),
        allowNull: false,
        defaultValue: 'none',
        field: 'participant_mode',
      },
      watcherMode: {
        type: DataTypes.ENUM('none', 'all', 'lists'),
        allowNull: false,
        defaultValue: 'none',
        field: 'watcher_mode',
      },

      statusAggregate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'status_aggregate' },

      completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
      completedById: { type: DataTypes.UUID, allowNull: true, field: 'completed_by_id' },

      counterpartyId: { type: DataTypes.UUID, allowNull: true, field: 'counterparty_id' },
      dealId:         { type: DataTypes.UUID, allowNull: true, field: 'deal_id' },

      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
    },
    {
      sequelize,
      modelName: 'Task',
      tableName: 'tasks',
      underscored: true,
      paranoid: true,
      timestamps: true,
      validate: {
        // Проверяет, что плановый конец не раньше старта (с учётом режима "только дата").
endAfterStart() {
          if (!this.startAt || !this.endAt) return;

          const start = new Date(this.startAt);
          const end = new Date(this.endAt);

          if (this.plannedStartHasTime === false && this.plannedEndHasTime === false) {
            if (end < start) throw new Error('endAt must be greater than or equal to startAt');
            return;
          }

          if (!(end > start)) throw new Error('endAt must be greater than startAt');
        },
        // Проверяет, что фактический конец не раньше фактического старта.
actualEndAfterStart() {
          if (!this.actualStartAt || !this.actualEndAt) return;

          const start = new Date(this.actualStartAt);
          const end = new Date(this.actualEndAt);

          if (this.actualStartHasTime === false && this.actualEndHasTime === false) {
            if (end < start) throw new Error('actualEndAt must be greater than or equal to actualStartAt');
            return;
          }

          if (!(end > start)) throw new Error('actualEndAt must be greater than actualStartAt');
        },
        visibilityDepartmentRequired() {
          if (this.visibility === 'department' && !this.visibilityDepartmentId) {
            throw new Error('visibilityDepartmentId is required when visibility is department');
          }
        },
      },
    }
  );

  return Task;
};
