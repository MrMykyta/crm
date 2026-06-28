// models/TaskUserParticipant.js
'use strict';
const { Model } = require('sequelize');

// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class TaskUserParticipant extends Model {
        // Описывает associations этой модели с другими сущностями.
static associate(models) {
      TaskUserParticipant.belongsTo(models.User, {
        foreignKey: { name: 'completedById', field: 'completed_by_id' },
        as: 'completedBy',
      });
    }
  }

  TaskUserParticipant.init(
    {
      id:       { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      taskId:   { type: DataTypes.UUID, allowNull: false, field: 'task_id' },
      userId:   { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      role:     { 
        type: DataTypes.ENUM('assignee', 'watcher'), 
        allowNull: false, 
        defaultValue: 'assignee' 
      },
      memberStatus: {
        type: DataTypes.ENUM('todo', 'in_progress', 'done', 'blocked', 'canceled'),
        allowNull: false,
        defaultValue: 'todo',
        field: 'member_status',
      },
      startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
      completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
      completedById: { type: DataTypes.UUID, allowNull: true, field: 'completed_by_id' },
      statusNote: { type: DataTypes.TEXT, allowNull: true, field: 'status_note' },
      createdAt:{ type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt:{ type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'TaskUserParticipant',
      tableName: 'task_user_participants',
      underscored: true,
      timestamps: true,
    }
  );

  return TaskUserParticipant;
};
