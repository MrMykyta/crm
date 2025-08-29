'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Parcel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Parcel.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false,
      defaultValue: sequelize.UUIDV4 
    },
    shipmentId:{ 
      type:DataTypes.UUID, 
      field:'shipment_id',
      allowNull:false 
    },
    carrier:{ 
      type:DataTypes.STRING(64) 
    },
    trackingNumber:{ 
      type:DataTypes.STRING(128), 
      field:'tracking_number' 
    },
    weight:{ 
      type:DataTypes.DECIMAL(12,3) 
    },
    dims:{ 
      type:DataTypes.JSONB 
    },
  }, {
    sequelize,
    modelName: 'Parcel',
    tableName:'parcels', 
    underscored:true, 
    timestamps:true
  });
  return Parcel;
};