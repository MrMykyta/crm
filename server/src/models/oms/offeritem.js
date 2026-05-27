'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OfferItem extends Model {
    static associate(models) {
      OfferItem.belongsTo(models.Offer, {
        as: 'offer',
        foreignKey: 'offerId',
      });
      OfferItem.belongsTo(models.Product, {
        as: 'product',
        foreignKey: 'productId',
      });
      OfferItem.belongsTo(models.ProductVariant, {
        as: 'variant',
        foreignKey: 'variantId',
      });
      OfferItem.belongsTo(models.Uom, {
        as: 'unit',
        foreignKey: 'uomId',
      });
      OfferItem.belongsTo(models.Uom, {
        as: 'uom',
        foreignKey: 'uomId',
      });
      OfferItem.hasMany(models.Discount, {
        as: 'discounts',
        foreignKey: 'ownerId',
        scope: { ownerType: 'offerItem' },
      });
    }
  }

  OfferItem.init({
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
    offerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'offer_id',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
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
    uomId: {
      type: DataTypes.UUID,
      allowNull: true,
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
    quantity: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('qty');
      },
      set(value) {
        this.setDataValue('qty', value);
      },
    },
    unitPriceNet: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('priceNet');
      },
      set(value) {
        this.setDataValue('priceNet', value);
      },
    },
    unitPriceGross: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('priceGross');
      },
      set(value) {
        this.setDataValue('priceGross', value);
      },
    },
  }, {
    sequelize,
    modelName: 'OfferItem',
    tableName: 'offer_items',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  return OfferItem;
};
