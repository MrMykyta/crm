'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SystemJob extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SystemJob.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
      SystemJob.hasMany(models.SystemJobRun, {
        foreignKey: 'job_id',
        as: 'runs',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
    }
  }
  SystemJob.init({
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
    payload: { 
      type: DataTypes.JSONB, 
      allowNull:true 
    },
    status: { 
      type: DataTypes.ENUM('queued','running','success','failed'), 
      allowNull:false, 
      defaultValue:'queued' 
    },
    runAt: { 
      type: DataTypes.DATE, 
      allowNull:true, 
      field:'run_at' 
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
    modelName: 'SystemJob',
    tableName:'system_jobs',
    underscored: true,
    timestamps:true
  });
  return SystemJob;
};