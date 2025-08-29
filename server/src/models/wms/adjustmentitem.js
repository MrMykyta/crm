'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AdjustmentItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
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
      allowNull:false, 
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
  }, {
    sequelize,
    modelName: 'AdjustmentItem',
    tableName:'adjustment_items', 
    underscored:true, 
    timestamps:true
  });
  return AdjustmentItem;
};