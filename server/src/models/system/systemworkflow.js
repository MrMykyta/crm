'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SystemWorkflow extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SystemWorkflow.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
      
      SystemWorkflow.hasMany(models.SystemTrigger, {
        foreignKey: 'workflow_id',
        as: 'triggers',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
    }
  }
  SystemWorkflow.init({
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
    name: { 
      type: DataTypes.STRING(128), 
      allowNull:false 
    },
    isActive: { 
      type: DataTypes.BOOLEAN, 
      allowNull:false, 
      defaultValue:true, 
      field:'is_active' 
    },
    definition: { 
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
    },
    deletedAt: { 
      type: DataTypes.DATE, 
      allowNull:true, 
      field:'deleted_at' 
    }
  }, {
    sequelize,
    modelName: 'SystemWorkflow',
    tableName:'system_workflows', 
    underscored: true,
    timestamps:true, 
    paranoid:true
  });
  return SystemWorkflow;
};