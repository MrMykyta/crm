'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class TransferItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      TransferItem.belongsTo(models.TransferOrder, {
        as: 'transfer',
        foreignKey: { name: 'transferId', field: 'transfer_id' },
      });
      TransferItem.belongsTo(models.Product, {
        as: 'product',
        foreignKey: { name: 'productId', field: 'product_id' },
      });
      TransferItem.belongsTo(models.ProductVariant, {
        as: 'variant',
        foreignKey: { name: 'variantId', field: 'variant_id' },
      });
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
    movedQty:{
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0,
      field: 'moved_qty',
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
