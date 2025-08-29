'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Product.belongsTo(models.Company, { 
        foreignKey: 'company_id', 
        as: 'company' 
      });
      Product.belongsTo(models.Brand, { 
        foreignKey: 'brand_id', 
        as: 'brand' 
      });
      Product.belongsTo(models.Category, { 
        foreignKey: 'primary_category_id', 
        as: 'primaryCategory' 
      });
      Product.belongsTo(models.Uom, { 
        foreignKey: 'uom_id', 
        as: 'uom' 
      });

      Product.belongsToMany(models.Category, {
        through: models.ProductCategory,
        foreignKey: 'product_id',
        otherKey: 'category_id',
        as: 'categories'
      });

      Product.hasMany(models.ProductVariant, { 
        foreignKey: 'product_id', 
        as: 'variants' 
      });
      Product.hasMany(models.ProductAttributeValue, { 
        foreignKey: 'product_id', 
        as: 'attributes' 
      });

      Product.belongsToMany(models.Attachments, {
        through: models.ProductAttachment,
        foreignKey: 'product_id',
        otherKey: 'attachment_id',
        as: 'attachments'
      });

      Product.belongsTo(models.ProductType, { 
        foreignKey:'product_type_id', 
        as:'type' 
      });
      Product.belongsTo(models.TaxCategory, { 
        foreignKey:'tax_category_id', 
        as:'taxCategory' 
      });
      Product.belongsTo(models.ShippingClass, { 
        foreignKey:'shipping_class_id', 
        as:'shippingClass' 
      });

      Product.hasMany(models.ProductLocalization, { 
        foreignKey:'product_id', 
        as:'localizations' 
      });
      Product.hasMany(models.ProductSupplier, { 
        foreignKey:'product_id', 
        as:'suppliers' 
      });
      Product.hasMany(models.ProductExternalRef, { 
        foreignKey:'product_id', 
        as:'externalRefs' 
      });
      Product.hasMany(models.PackagingUnit, { 
        foreignKey:'product_id', 
        as:'packaging' 
      });
      Product.hasMany(models.ProductComponent, { 
        foreignKey:'parent_product_id', 
        as:'components' 
      });
      Product.hasMany(models.ProductRelation, { 
        foreignKey:'source_product_id', 
        as:'relations' 
      });

      Product.belongsToMany(models.Tag, {
        through: models.ProductTag, 
        foreignKey:'product_id', 
        otherKey:'tag_id', 
        as:'tags'
      });
      Product.belongsToMany(models.Collection, {
        through: models.ProductCollection, 
        foreignKey:'product_id', 
        otherKey:'collection_id', 
        as:'collections'
      });
      Product.belongsTo(models.Product, { 
        foreignKey: 'replaced_by_product_id', 
        as: 'replacement' 
      });
    }
  }
  Product.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey:true,
      allowNull: false, 
      defaultValue: DataTypes.UUIDV4
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    brandId: { 
      type: DataTypes.UUID, 
      field:'brand_id' 
    },
    primaryCategoryId: { 
      type: DataTypes.UUID, 
      field:'primary_category_id' 
    },
    uomId: { 
      type: DataTypes.UUID, 
      field:'uom_id' 
    },

    sku: {
      type: DataTypes.STRING(64)
    },
    name: {
      type: DataTypes.STRING(255), 
      allowNull:false
    },
    slug: {
      type: DataTypes.STRING(300), 
      allowNull:false
    },
    barcode: {
      type: DataTypes.STRING(64)
    },
    description: {
      type: DataTypes.TEXT
    },

    status: {
      type: DataTypes.ENUM('draft','active','archived'), 
      allowNull:false, 
      defaultValue:'draft'
    },
    visibility: {
      type: DataTypes.ENUM('public','private'), 
      allowNull:false, 
      defaultValue:'public'
    },

    currency: {
      type: DataTypes.STRING(3), 
      allowNull:false, 
      defaultValue:'PLN'
    },
    price: {
      type: DataTypes.DECIMAL(14,2)
    },
    oldPrice: { 
      type: DataTypes.DECIMAL(14,2), 
      field:'old_price' 
    },
    cost: {
      type: DataTypes.DECIMAL(14,2)
    },

    weight: {
      type: DataTypes.DECIMAL(12,3)
    },
    length: {
      type: DataTypes.DECIMAL(12,3)
    },
    width:  {
      type: DataTypes.DECIMAL(12,3)
    },
    height: {
      type: DataTypes.DECIMAL(12,3)
    },

    trackInventory: { 
      type: DataTypes.BOOLEAN,
      allowNull: false, 
      field:'track_inventory', 
      defaultValue:false 
    },
    publishedAt: { 
      type: DataTypes.DATE, 
      field:'published_at' 
    },

    productTypeId: { 
      type: DataTypes.UUID, 
      field: 'product_type_id' 
    },
    taxCategoryId: { 
      type: DataTypes.UUID, 
      field: 'tax_category_id' 
    },
    shippingClassId: { 
      type: DataTypes.UUID, 
      field: 'shipping_class_id' 
    },

    hsCode: { 
      type: DataTypes.STRING(32), 
      field: 'hs_code' 
    },
    countryOfOrigin: { 
      type: DataTypes.STRING(2), 
      field: 'country_of_origin' 
    },
    warrantyMonths: { 
      type: DataTypes.INTEGER, 
      field: 'warranty_months', 
      defaultValue: 0 
    },
    dangerousGoodsClass: { 
      type: DataTypes.STRING(16), 
      field: 'dangerous_goods_class' 
    },
    unNumber: { 
      type: DataTypes.STRING(10), 
      field: 'un_number' 
    },

    isSerialized: { 
      type: DataTypes.BOOLEAN, 
      field: 'is_serialized', 
      defaultValue: false 
    },
    isLotTracked: { 
      type: DataTypes.BOOLEAN, 
      field: 'is_lot_tracked', 
      defaultValue: false 
    },
    shelfLifeDays: { 
      type: DataTypes.INTEGER, 
      field: 'shelf_life_days', 
      defaultValue: 0 
    },

    discontinuedAt: { 
      type: DataTypes.DATE, 
      field: 'discontinued_at' 
    },
    replacedByProductId: { 
      type: DataTypes.UUID, 
      field: 'replaced_by_product_id' 
    }
  }, {
    sequelize,
    modelName: 'Product',
    tableName: 'products',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, 
        fields: ['company_id','slug'], 
        name: 'uniq_product_company_slug' 
      }
    ],
  });
  return Product;
};