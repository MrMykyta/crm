'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class AdjustmentItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      AdjustmentItem.belongsTo(models.Adjustment, {
        as: 'adjustment',
        foreignKey: { name: 'adjustmentId', field: 'adjustment_id' },
      });
      AdjustmentItem.belongsTo(models.Location, {
        as: 'location',
        foreignKey: { name: 'locationId', field: 'location_id' },
      });
      AdjustmentItem.belongsTo(models.Product, {
        as: 'product',
        foreignKey: { name: 'productId', field: 'product_id' },
      });
      AdjustmentItem.belongsTo(models.ProductVariant, {
        as: 'variant',
        foreignKey: { name: 'variantId', field: 'variant_id' },
      });
    }
  }
  AdjustmentItem.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false,
      defaultValue: DataTypes.UUIDV4
    },
    adjustmentId:{ 
      type:DataTypes.UUID, 
      allowNull:false,
      field:'adjustment_id' 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull:false,
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    locationId:{ 
      type:DataTypes.UUID,
      allowNull:true,
      field:'location_id' 
    },
    lotId:{ 
      type:DataTypes.UUID, 
      field:'lot_id' 
    },
    serialId:{ 
      type:DataTypes.UUID, 
      field:'serial_id' 
    },
    qtyDelta:{ 
      type:DataTypes.DECIMAL(14,4),
      allowNull:false,
      field:'qty_delta' 
    },
    unitCost:{
      type:DataTypes.DECIMAL(14,4),
      field:'unit_cost'
    },
    totalCost:{
      type:DataTypes.DECIMAL(14,4),
      field:'total_cost'
    },
    currency:{
      type:DataTypes.STRING(3)
    },
  }, {
    sequelize,
    modelName: 'AdjustmentItem',
    tableName:'adjustment_items', 
    underscored:true, 
    timestamps:true
  });
  return AdjustmentItem;
};
