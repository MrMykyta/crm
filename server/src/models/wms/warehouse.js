'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Warehouse extends Model {
    static associate(models) {
      // define association here
      Warehouse.hasMany(models.Location, { 
        foreignKey:'warehouse_id', 
        as:'locations' 
      });
    }
  }
  Warehouse.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true 
    },
    companyId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    code:{ 
      type:DataTypes.STRING(32), 
      allowNull:false 
    },
    name:{ 
      type:DataTypes.STRING(160), 
      allowNull:false 
    },
    isActive:{ 
      type:DataTypes.BOOLEAN,
      allowNull:false,
      field:'is_active', 
      defaultValue:true 
    },
  }, {
    sequelize,
    modelName: 'Warehouse',
    tableName:'warehouses',
    underscored:true, 
    timestamps:true
  });
  return Warehouse;
};