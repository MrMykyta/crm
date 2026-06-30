'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
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
    order: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    color: { 
      type: DataTypes.STRING(16), 
      allowNull:true 
    },
    isWon: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_won'
    },
    isLost: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_lost'
    },
    hidden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    archived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isDefaultEntry: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default_entry'
    },
    wipLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'wip_limit'
    },
    rotDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'rot_days'
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
