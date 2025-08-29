'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductComponent extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductComponent.belongsTo(models.Product, { 
        foreignKey:'parent_product_id', 
        as:'parent' 
      });
      ProductComponent.belongsTo(models.Product, { 
        foreignKey:'component_product_id', 
        as:'componentProduct' 
      });
      ProductComponent.belongsTo(models.ProductVariant, { 
        foreignKey:'component_variant_id', 
        as:'componentVariant' 
      });
    }
  }
  ProductComponent.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    parentProductId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'parent_product_id' 
    },
    componentProductId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'component_product_id' 
    },
    componentVariantId:{ 
      type:DataTypes.UUID, 
      field:'component_variant_id' 
    },
    quantity:{ 
      type:DataTypes.DECIMAL(14,4), 
      allowNull:false, 
      defaultValue:1 
    },
    allowSubstitute:{ 
      type:DataTypes.BOOLEAN,
      field:'allow_substitute',
      allowNull:false, 
      defaultValue:false 
    }
  }, {
    sequelize,
    modelName: 'ProductComponent',
    tableName: 'product_components',
    underscored: true,
    timestamps: true
  });
  return ProductComponent;
};