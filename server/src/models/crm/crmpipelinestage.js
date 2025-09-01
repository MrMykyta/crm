'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CrmPipelineStage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      CrmPipelineStage.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
      CrmPipelineStage.belongsTo(models.CrmPipeline, {
        foreignKey: 'pipeline_id',
        as: 'pipeline',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
    }
  }
  CrmPipelineStage.init({
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
    pipelineId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'pipeline_id' 
    },
    name: { 
      type: DataTypes.STRING(128), 
      allowNull:false 
    },
    probability: { 
      type: DataTypes.INTEGER, 
      allowNull:false, 
      defaultValue:0 
    },
    position: { 
      type: DataTypes.INTEGER, 
      allowNull:false, 
      defaultValue:0 
    },
    color: { 
      type: DataTypes.STRING(16), 
      allowNull:true 
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
    modelName: 'CrmPipelineStage',
    tableName:'crm_pipeline_stages', 
    timestamps:true,
    underscored: true
  });
  return CrmPipelineStage;
};