'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class StockMove extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      StockMove.hasMany(models.StockMoveCostAllocation, {
        as: 'costAllocations',
        foreignKey: { name: 'stockMoveId', field: 'stock_move_id' },
      });
      StockMove.hasOne(models.CostLayer, {
        as: 'costLayer',
        foreignKey: { name: 'sourceMoveId', field: 'source_move_id' },
      });
      // K1: direct audit pointer for reversal moves emitted by correction postings.
      StockMove.belongsTo(models.StockMove, {
        as: 'reversesMove',
        foreignKey: { name: 'reversesMoveId', field: 'reverses_move_id' },
      });
      StockMove.hasOne(models.StockMove, {
        as: 'reversedByMove',
        foreignKey: { name: 'reversesMoveId', field: 'reverses_move_id' },
      });
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
    refItemId:{
      type:DataTypes.UUID,
      field:'ref_item_id'
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
    costMethod:{
      type:DataTypes.STRING(16),
      field:'cost_method'
    },
    reversesMoveId: {
      // K1: optional direct pointer "this move compensates move X". Set by correction posting.
      // Redundant with allocation-level reversedByStockMoveId, but cheaper for ledger audit.
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reverses_move_id',
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
