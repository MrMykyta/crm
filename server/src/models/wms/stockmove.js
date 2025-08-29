'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class StockMove extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  StockMove.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId:{ 
      type:DataTypes.UUID, 
      allowNull:false,
      field:'company_id' 
    },
    type:{ 
      type:DataTypes.ENUM('receipt','putaway','pick','pack','ship','adjustment','transfer'),
      allowNull:false 
    },
    warehouseId:{ 
      type:DataTypes.UUID, 
      allowNull:false,
      field:'warehouse_id' 
    },
    fromLocationId:{ 
      type:DataTypes.UUID, 
      field:'from_location_id' 
    },
    toLocationId:{ 
      type:DataTypes.UUID, 
      field:'to_location_id' 
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
    lotId:{ 
      type:DataTypes.UUID, 
      field:'lot_id' 
    },
    serialId:{ 
      type:DataTypes.UUID, 
      field:'serial_id' 
    },
    qty:{ 
      type:DataTypes.DECIMAL(14,4), 
      allowNull:false
    },
    refType:{ 
      type:DataTypes.STRING(32), 
      field:'ref_type' 
    },
    refId:{ 
      type:DataTypes.UUID, 
      field:'ref_id' 
    },
  }, {
    sequelize,
    modelName: 'StockMove',
    tableName:'stock_moves', 
    underscored:true, 
    timestamps:true
  });
  return StockMove;
};