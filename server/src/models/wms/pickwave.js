'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PickWave extends Model {
    static associate(models) {
      // define association here
      PickWave.hasMany(models.PickTask,{ 
        foreignKey:'wave_id', 
        as:'tasks' 
      });
    }
  }
  PickWave.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true ,
      allowNull: false,  // Set to false to allow null values
      defaultValue: DataTypes.UUIDV4
    },
    companyId:{ 
      type:DataTypes.UUID, 
      field:'company_id',
      allowNull: false
    },
    warehouseId:{ 
      type:DataTypes.UUID, 
      field:'warehouse_id',
      allowNull: false
    },
    status:{ 
      type:DataTypes.ENUM('planned','picking','completed','cancelled'), 
      allowNull: false,  // Set to false to allow null values
      defaultValue:'planned' 
    },
  }, {
    sequelize,
    modelName: 'PickWave',
    tableName:'pick_waves', 
    underscored:true, 
    timestamps:true
  });
  return PickWave;
};