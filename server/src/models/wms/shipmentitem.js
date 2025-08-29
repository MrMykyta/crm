'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ShipmentItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ShipmentItem.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false,
      defaultValue: DataTypes.UUIDV4
    },
    shipmentId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Shipment is required to create a ShipmentItem
      field:'shipment_id' 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Product is required to create a ShipmentItem
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    qty:{ 
      type:DataTypes.DECIMAL(14,4), 
      allowNull:false 
    },
  }, {
    sequelize,
    modelName: 'ShipmentItem',
    tableName:'shipment_items', 
    underscored:true, 
    timestamps:true
  });
  return ShipmentItem;
};