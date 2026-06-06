'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CostLayer extends Model {
    static associate(models) {
      CostLayer.belongsTo(models.StockMove, {
        as: 'sourceMove',
        foreignKey: { name: 'sourceMoveId', field: 'source_move_id' },
      });
      CostLayer.hasMany(models.StockMoveCostAllocation, {
        as: 'allocations',
        foreignKey: { name: 'costLayerId', field: 'cost_layer_id' },
      });
      CostLayer.belongsTo(models.StockMoveCostAllocation, {
        as: 'sourceAllocation',
        foreignKey: { name: 'sourceAllocationId', field: 'source_allocation_id' },
      });
    }
  }

  CostLayer.init(
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
      warehouseId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'warehouse_id',
      },
      locationId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'location_id',
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'product_id',
      },
      variantId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'variant_id',
      },
      sourceMoveId: {
        // Nullable for OPENING layers (synthesized from existing qty_on_hand before costing was wired).
        // CHECK cost_layers_source_or_opening_chk enforces (source_move_id IS NOT NULL) OR (source_ref_type = 'OPENING').
        type: DataTypes.UUID,
        allowNull: true,
        field: 'source_move_id',
      },
      sourceAllocationId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'source_allocation_id',
      },
      sourceRefType: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: 'source_ref_type',
      },
      sourceRefId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'source_ref_id',
      },
      sourceRefItemId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'source_ref_item_id',
      },
      qtyIn: {
        type: DataTypes.DECIMAL(14, 4),
        allowNull: false,
        defaultValue: 0,
        field: 'qty_in',
      },
      qtyRemaining: {
        type: DataTypes.DECIMAL(14, 4),
        allowNull: false,
        defaultValue: 0,
        field: 'qty_remaining',
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
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'received_at',
      },
    },
    {
      sequelize,
      modelName: 'CostLayer',
      tableName: 'cost_layers',
      underscored: true,
      timestamps: true,
    }
  );

  return CostLayer;
};
