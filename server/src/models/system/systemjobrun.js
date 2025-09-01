'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SystemJobRun extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SystemJobRun.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
      SystemJobRun.belongsTo(models.SystemJob, {
        foreignKey: 'job_id',
        as: 'job',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
    }
  }
  SystemJobRun.init({
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
    jobId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'job_id' 
    },
    status: { 
      type: DataTypes.ENUM('running','success','failed'), 
      allowNull:false 
    },
    startedAt: { 
      type: DataTypes.DATE, 
      allowNull:false, 
      field:'started_at' 
    },
    finishedAt: { 
      type: DataTypes.DATE, 
      allowNull:true, 
      field:'finished_at' 
    },
    errorMessage: { 
      type: DataTypes.TEXT, 
      allowNull:true, 
      field:'error_message' 
    }
  }, {
    sequelize,
    modelName: 'SystemJobRun',
    tableName:'system_job_runs', 
    underscored: true,  // Convert snake_case to camelCase
    timestamps:false
  });
  return SystemJobRun;
};