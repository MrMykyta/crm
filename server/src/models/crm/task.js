'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Task.belongsTo(models.Company, { 
        foreignKey: 'companyId', 
        as: 'company' 
      });
      Task.belongsTo(models.Counterparty, { 
        foreignKey: 'counterpartyId', 
        as: 'counterparty' 
      });
      Task.belongsTo(models.Deal, { 
        foreignKey: 'dealId',
         as: 'deal' 
        });

      Task.belongsTo(models.User, { 
        foreignKey: 'creatorId', 
        as: 'creator' 
      });
      Task.belongsTo(models.User, { 
        foreignKey: 'assigneeId', 
        as: 'assignee' 
      });
    }
  }
  Task.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'company_id' 
    },
    counterpartyId: { 
      type: DataTypes.UUID, 
      allowNull: true, 
      field: 'counterparty_id' 
    },
    dealId: { 
      type: DataTypes.UUID, 
      allowNull: true, 
      field: 'deal_id' 
    },
    title: { 
      type: DataTypes.STRING(256), 
      allowNull: false 
    },
    description: { 
      type: DataTypes.TEXT 
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'done', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'medium'
    },
    dueDate: { 
      type: DataTypes.DATE, 
      field: 'due_date' 
    },
    createdBy: { 
      type: DataTypes.UUID, 
      field: 'created_by' 
    },
    assigneeId: { 
      type: DataTypes.UUID, 
      field: 'assignee_id' 
    },
    updatedBy: {
      type: DataTypes.UUID, 
      field: 'updated_by'
    },
    ownerType: { 
      type: DataTypes.ENUM('user', 'department'), 
      allowNull: false, 
      field: 'owner_type', 
      defaultValue: 'user' 
    },
    ownerId: { 
      type: DataTypes.UUID, 
      field: 'owner_id' 
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
      },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
      },
  }, {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    underscored: true,
    timestamps: true
  });
  return Task;
};