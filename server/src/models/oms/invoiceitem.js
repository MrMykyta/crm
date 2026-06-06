'use strict';

const { Model } = require('sequelize');

// A2: InvoiceItem — new in this migration. Mirrors the unified LineItem shape so finance
// documents stop reading mutable order_items at print time. Population of these rows
// happens in A3 (invoiceService.issue). For now the model + table exist but no service
// writes to them yet, keeping runtime behavior unchanged.
module.exports = (sequelize, DataTypes) => {
  class InvoiceItem extends Model {
    static associate(models) {
      InvoiceItem.belongsTo(models.Invoice, {
        as: 'invoice',
        foreignKey: 'invoiceId',
      });
      InvoiceItem.belongsTo(models.OrderItem, {
        as: 'orderItem',
        foreignKey: 'orderItemId',
      });
      InvoiceItem.belongsTo(models.Product, {
        as: 'product',
        foreignKey: 'productId',
      });
      InvoiceItem.belongsTo(models.ProductVariant, {
        as: 'variant',
        foreignKey: 'variantId',
      });
      if (models.TaxCategory) {
        InvoiceItem.belongsTo(models.TaxCategory, {
          as: 'taxCategory',
          foreignKey: 'taxCategoryId',
        });
      }
      InvoiceItem.belongsTo(models.InvoiceItem, {
        as: 'parentLineItem',
        foreignKey: 'parentLineItemId',
      });
    }
  }

  InvoiceItem.init({
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
    invoiceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'invoice_id',
    },
    orderItemId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'order_item_id',
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'product_id',
    },
    variantId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'variant_id',
    },
    taxCategoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'tax_category_id',
    },
    parentLineItemId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'parent_line_item_id',
    },
    lineType: {
      // Shared PG ENUM `product_service_line_type`; Sequelize validates JS-side that the
      // value is one of these literals.
      type: DataTypes.ENUM('product', 'service', 'custom', 'fee', 'discount'),
      allowNull: false,
      defaultValue: 'product',
      field: 'line_type',
    },
    affectsInventory: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'affects_inventory',
    },
    isStockTrackedSnapshot: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_stock_tracked_snapshot',
    },
    skuSnapshot: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'sku_snapshot',
    },
    nameSnapshot: {
      type: DataTypes.STRING(512),
      allowNull: false,
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
    productTypeSnapshot: {
      type: DataTypes.STRING(64),
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
      defaultValue: 0,
      field: 'price_net',
    },
    priceGross: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'price_gross',
    },
    taxRate: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'tax_rate',
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
      defaultValue: 0,
      field: 'discount_amount',
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
    lineTotalNet: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'line_total_net',
    },
    lineTotalGross: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'line_total_gross',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
    },
  }, {
    sequelize,
    modelName: 'InvoiceItem',
    tableName: 'invoice_items',
    underscored: true,
    timestamps: true,
    paranoid: true,
  });

  return InvoiceItem;
};
