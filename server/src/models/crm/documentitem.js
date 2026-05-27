'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DocumentItem extends Model {
    static associate(models) {
      DocumentItem.belongsTo(models.Document, {
        as: 'document',
        foreignKey: { name: 'documentId', field: 'document_id' },
      });
      DocumentItem.belongsTo(models.Product, {
        as: 'product',
        foreignKey: { name: 'productId', field: 'product_id' },
      });
      DocumentItem.belongsTo(models.Warehouse, {
        as: 'warehouse',
        foreignKey: { name: 'warehouseId', field: 'warehouse_id' },
      });
    }
  }

  DocumentItem.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      documentId: { type: DataTypes.UUID, allowNull: false, field: 'document_id' },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
      productId: { type: DataTypes.UUID, allowNull: true, field: 'product_id' },
      name: { type: DataTypes.STRING(512), allowNull: false },
      sku: { type: DataTypes.STRING(128), allowNull: true },
      ean: { type: DataTypes.STRING(64), allowNull: true },
      pkwiu: { type: DataTypes.STRING(64), allowNull: true },
      cn: { type: DataTypes.STRING(64), allowNull: true },
      gtu: { type: DataTypes.STRING(64), allowNull: true },
      itemType: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'custom', field: 'item_type' },
      quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 1 },
      unit: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'szt' },
      unitNet: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'unit_net' },
      unitGross: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'unit_gross' },
      vatRate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0, field: 'vat_rate' },
      discountPercent: {
        type: DataTypes.DECIMAL(8, 4),
        allowNull: false,
        defaultValue: 0,
        field: 'discount_percent',
      },
      discountValue: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'discount_value',
      },
      sumNet: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'sum_net' },
      sumVat: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'sum_vat' },
      sumGross: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'sum_gross' },
      warehouseId: { type: DataTypes.UUID, allowNull: true, field: 'warehouse_id' },
      comment: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      sequelize,
      modelName: 'DocumentItem',
      tableName: 'document_items',
      underscored: true,
      timestamps: true,
    }
  );

  return DocumentItem;
};

