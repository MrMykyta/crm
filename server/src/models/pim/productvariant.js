'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductVariant extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      
      ProductVariant.belongsTo(models.Product, { 
        foreignKey: 'product_id', 
        as: 'product' 
      });
      ProductVariant.belongsTo(models.Uom, { 
        foreignKey: 'uom_id', 
        as: 'uom' 
      });
      ProductVariant.hasMany(models.VariantOption, { 
        foreignKey: 'variant_id', 
        as: 'options' 
      });
    }
  }
  ProductVariant.init({
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
    productId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'product_id' 
    },
    sku: { 
      type: DataTypes.STRING(64), 
      allowNull:false 
    },
    barcode: {
      type: DataTypes.STRING(64)
    },
    currency: {
      type: DataTypes.STRING(3), 
      allowNull: false, 
      defaultValue: 'PLN'
    },
    price: {
      type: DataTypes.DECIMAL(14,2)
    },
    cost: {
      type: DataTypes.DECIMAL(14,2)
    },
    uomId: { 
      type: DataTypes.UUID, 
      field:'uom_id' 
    },
    weight: {
      type: DataTypes.DECIMAL(12,3)
    }, 
    length: {
      type: DataTypes.DECIMAL(12,3)
    }, 
    width: {
      type: DataTypes.DECIMAL(12,3)
    }, 
    height: {
      type: DataTypes.DECIMAL(12,3)
    },
    isActive: { 
      type: DataTypes.BOOLEAN,
      allowNull:false,
      field:'is_active', 
      defaultValue:true 
    }
  }, {
    sequelize,
    modelName: 'ProductVariant',
    tableName: 'product_variants',
    underscored: true,
    timestamps: true
  });
  return ProductVariant;
};