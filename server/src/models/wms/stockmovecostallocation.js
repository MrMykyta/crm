'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockMoveCostAllocation extends Model {
    static associate(models) {
      StockMoveCostAllocation.belongsTo(models.StockMove, {
        as: 'stockMove',
        foreignKey: { name: 'stockMoveId', field: 'stock_move_id' },
      });
      StockMoveCostAllocation.belongsTo(models.CostLayer, {
        as: 'costLayer',
        foreignKey: { name: 'costLayerId', field: 'cost_layer_id' },
      });
      StockMoveCostAllocation.hasOne(models.CostLayer, {
        as: 'targetLayer',
        foreignKey: { name: 'sourceAllocationId', field: 'source_allocation_id' },
      });
      // K1: reverse pointer to the stock_move that compensates this allocation
      // (set by the correction posting; allocation row stays, soft-marked with reversedAt).
      StockMoveCostAllocation.belongsTo(models.StockMove, {
        as: 'reversedByStockMove',
        foreignKey: { name: 'reversedByStockMoveId', field: 'reversed_by_stock_move_id' },
      });
    }
  }

  StockMoveCostAllocation.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      stockMoveId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'stock_move_id',
      },
      costLayerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'cost_layer_id',
      },
      qty: {
        type: DataTypes.DECIMAL(14, 4),
        allowNull: false,
      },
      unitCost: {
        type: DataTypes.DECIMAL(14, 4),
        allowNull: false,
        field: 'unit_cost',
      },
      totalCost: {
        type: DataTypes.DECIMAL(14, 4),
        allowNull: false,
        field: 'total_cost',
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'PLN',
      },
      reversedAt: {
        // K1: soft-mark for reverse. Null = active allocation. Set when a correction posting
        // returns qty back to the source layer; the original row is kept for audit.
        type: DataTypes.DATE,
        allowNull: true,
        field: 'reversed_at',
      },
      reversedByStockMoveId: {
        // K1: the stock_move (typically of a *_KOREKTA document) that reverses this allocation.
        type: DataTypes.UUID,
        allowNull: true,
        field: 'reversed_by_stock_move_id',
      },
    },
    {
      sequelize,
      modelName: 'StockMoveCostAllocation',
      tableName: 'stock_move_cost_allocations',
      underscored: true,
      timestamps: true,
    }
  );

  return StockMoveCostAllocation;
};
