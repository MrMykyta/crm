'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Shipment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Shipment.hasMany(models.ShipmentItem,{ 
        foreignKey:'shipment_id', 
        as:'items' 
      }); 
      Shipment.hasMany(models.Parcel,{ 
        foreignKey:'shipment_id', 
        as:'parcels' 
      });
    }
  }
  Shipment.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId:{ 
      type:DataTypes.UUID, 
      field:'company_id',
      allowNull:false
    },
    warehouseId:{ 
      type:DataTypes.UUID, 
      field:'warehouse_id',
      allowNull:false 
    },
    orderId:{ 
      type:DataTypes.UUID, 
      field:'order_id',
    },
    status:{ 
      type:DataTypes.ENUM('packing','shipped','cancelled'), 
      allowNull:false, 
      defaultValue:'packing' 
    },
  }, {
    sequelize,
    modelName: 'Shipment',
    tableName:'shipments',
    underscored: true, 
    timestamps: true
  });
  return Shipment;
};