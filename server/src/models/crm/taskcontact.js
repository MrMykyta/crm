'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TaskContact extends Model {
    static associate(models) {
      TaskContact.belongsTo(models.Task, {
        foreignKey: { name: 'taskId', field: 'task_id' },
        as: 'task',
      });
      TaskContact.belongsTo(models.Contact, {
        foreignKey: { name: 'contactId', field: 'contact_id' },
        as: 'contact',
      });
    }
  }

  TaskContact.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      taskId: { type: DataTypes.UUID, allowNull: false, field: 'task_id' },
      contactId: { type: DataTypes.UUID, allowNull: false, field: 'contact_id' },

      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'TaskContact',
      tableName: 'task_contacts',
      underscored: true,
      timestamps: true,
    }
  );

  return TaskContact;
};