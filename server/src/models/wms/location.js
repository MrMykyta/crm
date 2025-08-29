'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Location extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Location.belongsTo(models.Warehouse, { 
        foreignKey:'warehouse_id', 
        as:'warehouse' 
      });
    }
  }
  Location.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true 
    },
    companyId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    warehouseId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'warehouse_id' 
    },
    code:{ 
      type:DataTypes.STRING(64), 
      allowNull:false  
    },
    type:{ 
      type:DataTypes.ENUM('inbound','pick','bulk','buffer','staging','outbound'), 
      allowNull:false, 
      defaultValue:'bulk' 
    },
  }, {
    sequelize,
    modelName: 'Location',
    tableName:'locations', 
    underscored:true, 
    timestamps:true
  });
  return Location;
};