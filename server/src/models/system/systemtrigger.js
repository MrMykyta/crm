'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SystemTrigger extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SystemTrigger.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
      SystemTrigger.belongsTo(models.SystemWorkflow, {
        foreignKey: 'workflow_id',
        as: 'workflow',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
    }
  }
  SystemTrigger.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey:true,
      allowNull:false, 
      defaultValue:DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    workflowId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'workflow_id' 
    },
    type: { 
      type: DataTypes.ENUM('event','cron','webhook'), 
      allowNull:false 
    },
    config: { 
      type: DataTypes.JSONB, 
      allowNull:false 
    },
    createdAt: { 
      type: DataTypes.DATE, 
      allowNull:false, 
      field:'created_at' 
    },
    updatedAt: { 
      type: DataTypes.DATE, 
      allowNull:false, 
      field:'updated_at' 
    }
  }, {
    sequelize,
    modelName: 'SystemTrigger',
    tableName:'system_triggers', 
    timestamps:true,
    underscored: true
  });
  return SystemTrigger;
};