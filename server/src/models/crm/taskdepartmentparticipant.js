'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TaskDepartmentParticipant extends Model {
    // Для through-модели ассоциации не нужны.
    static associate(/* models */) {}
  }

  TaskDepartmentParticipant.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      taskId:       { type: DataTypes.UUID, allowNull: false, field: 'task_id' },
      departmentId: { type: DataTypes.UUID, allowNull: false, field: 'department_id' },
      createdAt:    { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt:    { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'TaskDepartmentParticipant',
      tableName: 'task_department_participants',
      underscored: true,
      timestamps: true,
    }
  );

  return TaskDepartmentParticipant;
};