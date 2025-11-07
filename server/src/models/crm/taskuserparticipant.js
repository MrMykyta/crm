// models/TaskUserParticipant.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TaskUserParticipant extends Model {
    static associate() {}
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