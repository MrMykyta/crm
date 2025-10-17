'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Deal extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Deal.belongsTo(models.Company, { 
        foreignKey: 'companyId', 
        as: 'company' 
      });
      Deal.belongsTo(models.Counterparty, { 
        foreignKey: 'counterpartyId', 
        as: 'counterparty' 
      });
      Deal.belongsTo(models.User, { 
        foreignKey: 'responsibleId', 
        as: 'responsible' 
      });


      Deal.hasMany(models.Task, { 
        foreignKey: 'dealId', 
        as: 'tasks' 
      });
    }
  }
  Deal.init({
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
      allowNull: false, 
      field: 'counterparty_id' 
    },
    title: { 
      type: DataTypes.STRING(256), 
      allowNull: false 
    },
    description: { 
      type: DataTypes.TEXT 
    },
    status: {
      type: DataTypes.ENUM('new', 'in_progress', 'won', 'lost'),
      allowNull: false,
      defaultValue: 'new'
    },
    value: { 
      type: DataTypes.DECIMAL(14,2) 
    },
    currency: { 
      type: DataTypes.STRING(8), 
      defaultValue: 'PLN' 
    },
    responsibleId: { 
      type: DataTypes.UUID, 
      field: 'responsible_id' 
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'updated_by'
    },
    pipelineId: { 
      type: DataTypes.UUID,
      allowNull:true, 
      field: 'pipeline_id' 
    },
    stageId: {
      type: DataTypes.UUID, 
      allowNull:true,
      field:'stage_id'
    },
    stageEnteredAt: {
      type: DataTypes.DATE,
      allowNull:true,
      field:'stage_entered_at'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at'
    }
  }, {
    sequelize,
    modelName: 'Deal',
    tableName: 'deals',
    underscored: true,
    timestamps: true
  });
  return Deal;
};