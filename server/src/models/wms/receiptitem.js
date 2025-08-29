'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ReceiptItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ReceiptItem.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false,
      defaultValue: DataTypes.UUIDV4
    },
    receiptId:{ 
      type:DataTypes.UUID, 
      field:'receipt_id',
      allowNull: false 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull: false,  // Required
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    lotNumber:{ 
      type:DataTypes.STRING(64), 
      field:'lot_number' 
    },
    serialNumber:{ 
      type:DataTypes.STRING(128), 
      field:'serial_number' 
    },
    qtyExpected:{ 
      type:DataTypes.DECIMAL(14,4), 
      allowNull: false,  // Required
      field:'qty_expected', 
      defaultValue:0 
    },
    qtyReceived:{ 
      type:DataTypes.DECIMAL(14,4), 
      field:'qty_received', 
      defaultValue:0
    },
  }, {
    sequelize,
    modelName: 'ReceiptItem',
    tableName:'receipt_items', 
    underscored:true, 
    timestamps:true
  });
  return ReceiptItem;
};