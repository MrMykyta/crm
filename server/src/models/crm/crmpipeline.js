'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CrmPipeline extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      CrmPipeline.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
      CrmPipeline.hasMany(models.CrmPipelineStage, {
        foreignKey: 'pipeline_id',
        as: 'stages',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
    }
  }
  CrmPipeline.init({
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
    description: { 
      type: DataTypes.TEXT, 
      allowNull:true 
    },
    isDefault: { 
      type: DataTypes.BOOLEAN, 
      allowNull:false, 
      defaultValue:false, 
      field:'is_default' 
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
    modelName: 'CrmPipeline',
    tableName:'crm_pipelines', 
    timestamps:true, 
    paranoid:true,
    underscored: true
  });
  return CrmPipeline;
};