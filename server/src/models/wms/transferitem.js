'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TransferItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  TransferItem.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    transferId:{ 
      type:DataTypes.UUID, 
      field:'transfer_id',
      allowNull: false 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull: false, 
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    lotId:{ 
      type:DataTypes.UUID, 
      field:'lot_id' 
    },
    serialId:{ 
      type:DataTypes.UUID, 
      field:'serial_id' 
    },
    qty:{ 
      type:DataTypes.DECIMAL,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'TransferItem',
    tableName: 'transfer_items',
    underscored: true,
    timestamps: true
  });
  return TransferItem;
};