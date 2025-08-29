'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductExternalRef extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductExternalRef.belongsTo(models.Product, { 
        foreignKey:'product_id', 
        as:'product' 
      });
      ProductExternalRef.belongsTo(models.ProductVariant, { 
        foreignKey:'variant_id', 
        as:'variant' 
      });
    }
  }
  ProductExternalRef.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    companyId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    productId:{ 
      type:DataTypes.UUID, 
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    system:{
      type: DataTypes.STRING(64),
      allowNull: false,
    }, 
    externalId:{ 
      type:DataTypes.STRING(160),
      allowNull: false, 
      field:'external_id' 
    }, 
    data:{
      type: DataTypes.JSONB
    }
  }, {
    sequelize,
    modelName: 'ProductExternalRef',
    tableName: 'product_external_refs',
    underscored: true,
    timestamps: true,
  });
  return ProductExternalRef;
};