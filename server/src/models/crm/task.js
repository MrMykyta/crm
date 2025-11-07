'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      Task.belongsTo(models.Company, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'company',
      });
      Task.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', field: 'created_by' },
        as: 'creator',
      });

      Task.belongsTo(models.Counterparty, {
        foreignKey: { name: 'counterpartyId', field: 'counterparty_id' },
        as: 'counterparty',
      });

      Task.belongsTo(models.Deal, {
        foreignKey: { name: 'dealId', field: 'deal_id' },
        as: 'deal',
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

    get isAllDay() {
      // all-day = когда есть дата, но время незначимо (храним как [00:00, next 00:00))
      return !!(this.startAt && this.endAt &&
        new Date(this.endAt).getTime() - new Date(this.startAt).getTime() === 24 * 3600 * 1000 &&
        new Date(this.startAt).getHours() === 0 &&
        new Date(this.startAt).getMinutes() === 0);
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

      startAt:   { type: DataTypes.DATE, allowNull: true, field: 'start_at' },
      endAt:     { type: DataTypes.DATE, allowNull: true, field: 'end_at' },
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
        endAfterStart() {
          if (this.startAt && this.endAt && !(this.endAt > this.startAt)) {
            throw new Error('endAt must be greater than startAt');
          }
        },
      },
      hooks: {
        // если передали только дату (без времени) — нормализуем в [00:00; +1день)
        beforeValidate(task) {
          if (!task.startAt && !task.endAt) return;
          const s = task.startAt ? new Date(task.startAt) : null;
          const e = task.endAt ? new Date(task.endAt) : null;

          if (s && !e && s.getHours() === 0 && s.getMinutes() === 0) {
            const next = new Date(s);
            next.setDate(next.getDate() + 1);
            task.endAt = next;
          }
          if (s && e && e <= s) {
            const next = new Date(s);
            next.setDate(next.getDate() + 1);
            task.endAt = next;
          }
        },
      },
    }
  );

  return Task;
};