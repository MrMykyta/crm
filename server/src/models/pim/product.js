'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
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
      Product.belongsTo(models.Category, {
        foreignKey: 'subcategory_id',
        as: 'subcategory'
      });
      Product.belongsTo(models.Uom, { 
        foreignKey: 'uom_id', 
        as: 'uom' 
      });
      Product.belongsTo(models.Counterparty, {
        foreignKey: 'supplier_id',
        as: 'supplier'
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
      Product.hasMany(models.InventoryItem, {
        foreignKey: { name: 'productId', field: 'product_id' },
        as: 'inventoryItems'
      });
      Product.hasMany(models.ProductAttributeValue, { 
        foreignKey: 'product_id', 
        as: 'attributes' 
      });

      Product.belongsToMany(models.File, {
        through: models.ProductAttachment,
        foreignKey: 'product_id',
        otherKey: 'attachment_id',
        as: 'attachments'
      });

      Product.belongsTo(models.ProductType, {
        foreignKey: 'productTypeId',
        as: 'type'
      });
      Product.belongsTo(models.TaxCategory, {
        foreignKey: 'taxCategoryId',
        as: 'taxCategory'
      });
      Product.belongsTo(models.ShippingClass, {
        foreignKey: 'shippingClassId',
        as: 'shippingClass'
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
        foreignKey: 'replacedByProductId',
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
    subcategoryId: {
      type: DataTypes.UUID,
      field: 'subcategory_id'
    },
    uomId: { 
      type: DataTypes.UUID, 
      field:'uom_id' 
    },
    supplierId: {
      type: DataTypes.UUID,
      field: 'supplier_id'
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
    ean: {
      type: DataTypes.STRING(32)
    },
    pkwiu: {
      type: DataTypes.STRING(32)
    },
    cn: {
      type: DataTypes.STRING(32)
    },
    gtu: {
      type: DataTypes.STRING(32)
    },
    description: {
      type: DataTypes.TEXT
    },
    saleStartDate: {
      type: DataTypes.DATEONLY,
      field: 'sale_start_date'
    },
    saleEndDate: {
      type: DataTypes.DATEONLY,
      field: 'sale_end_date'
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
    stockQuantity: {
      type: DataTypes.DECIMAL(14,3),
      allowNull: false,
      field: 'stock_quantity',
      defaultValue: 0
    },
    reservedQuantity: {
      type: DataTypes.DECIMAL(14,3),
      allowNull: false,
      field: 'reserved_quantity',
      defaultValue: 0
    },
    orderedQuantity: {
      type: DataTypes.DECIMAL(14,3),
      allowNull: false,
      field: 'ordered_quantity',
      defaultValue: 0
    },
    isSellable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'is_sellable',
      defaultValue: true
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
    // A2: line-item foundation — marks a product as a service for unified line items.
    // When true, OfferItem/OrderItem/InvoiceItem.lineType is derived as 'service' and
    // affectsInventory is forced to false regardless of trackInventory.
    isService: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'is_service',
      defaultValue: false,
    },
    publishedAt: { 
      type: DataTypes.DATE, 
      field:'published_at' 
    },

    productTypeId: {
      type: DataTypes.UUID,
      field: 'productTypeId'
    },
    taxCategoryId: {
      type: DataTypes.UUID,
      field: 'taxCategoryId'
    },
    shippingClassId: {
      type: DataTypes.UUID,
      field: 'shippingClassId'
    },

    hsCode: {
      type: DataTypes.STRING(32),
      field: 'hsCode'
    },
    countryOfOrigin: {
      type: DataTypes.STRING(2),
      field: 'countryOfOrigin'
    },
    warrantyMonths: {
      type: DataTypes.INTEGER,
      field: 'warrantyMonths',
      defaultValue: 0
    },
    dangerousGoodsClass: {
      type: DataTypes.STRING(16),
      field: 'dangerousGoodsClass'
    },
    unNumber: {
      type: DataTypes.STRING(10),
      field: 'unNumber'
    },

    isSerialized: {
      type: DataTypes.BOOLEAN,
      field: 'isSerialized',
      defaultValue: false
    },
    isLotTracked: {
      type: DataTypes.BOOLEAN,
      field: 'isLotTracked',
      defaultValue: false
    },
    shelfLifeDays: {
      type: DataTypes.INTEGER,
      field: 'shelfLifeDays',
      defaultValue: 0
    },

    discontinuedAt: {
      type: DataTypes.DATE,
      field: 'discontinuedAt'
    },
    replacedByProductId: {
      type: DataTypes.UUID,
      field: 'replacedByProductId'
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
