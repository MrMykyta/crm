'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      OrderItem.belongsTo(models.Order, {
        as: 'order',
        foreignKey: 'orderId',
      });
      OrderItem.belongsTo(models.Product, {
        as: 'product',
        foreignKey: 'productId',
      });
      OrderItem.belongsTo(models.ProductVariant, {
        as: 'variant',
        foreignKey: 'variantId',
      });
      OrderItem.belongsTo(models.Uom, {
        as: 'unit',
        foreignKey: 'uomId',
      });
      OrderItem.belongsTo(models.Uom, {
        as: 'uom',
        foreignKey: 'uomId',
      });
      OrderItem.belongsTo(models.PriceListItem, {
        as: 'priceListItem',
        foreignKey: 'priceListItemId',
      });

      OrderItem.hasMany(models.Discount, {
        as: 'discounts',
        foreignKey: 'ownerId',
        scope: { ownerType: 'orderItem' },
      });
      OrderItem.hasMany(models.Reservation, {
        as: 'reservations',
        foreignKey: 'orderItemId',
      });
    }
  }

  OrderItem.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id',
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_id',
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'product_id',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
    },
    variantId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'variant_id',
    },
    uomId: {
      type: DataTypes.UUID,
      field: 'uom_id',
    },
    sku: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    skuSnapshot: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'sku_snapshot',
    },
    nameSnapshot: {
      type: DataTypes.STRING(512),
      allowNull: true,
      field: 'name_snapshot',
    },
    descriptionSnapshot: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'description_snapshot',
    },
    unitSnapshot: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'unit_snapshot',
    },
    vatRateSnapshot: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: true,
      field: 'vat_rate_snapshot',
    },
    productTypeSnapshot: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'product_type_snapshot',
    },
    metadataSnapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'metadata_snapshot',
    },
    qty: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 1,
    },
    priceNet: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      field: 'price_net',
    },
    priceGross: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      field: 'price_gross',
    },
    taxRate: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: false,
      field: 'tax_rate',
      defaultValue: 0,
    },
    discountType: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'none',
      field: 'discount_type',
    },
    discountValue: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'discount_value',
    },
    discountAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      field: 'discount_amount',
      defaultValue: 0,
    },
    lineSubtotalNet: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'line_subtotal_net',
    },
    lineVat: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'line_vat',
    },
    lineTotalGross: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'line_total_gross',
    },
    isCustomLine: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_custom_line',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    priceListItemId: {
      type: DataTypes.UUID,
      field: 'price_list_item_id',
    },
    quantity: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('qty');
      },
      set(value) {
        this.setDataValue('qty', value);
      },
    },
  }, {
    sequelize,
    modelName: 'OrderItem',
    tableName: 'order_items',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  return OrderItem;
};
