'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductTypeAttribute extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductTypeAttribute.belongsTo(models.ProductType, { 
        foreignKey:'product_type_id', 
        as:'type' 
      });
      ProductTypeAttribute.belongsTo(models.Attribute, { 
        foreignKey:'attribute_id', 
        as:'attribute' 
      });
    }
  }
  ProductTypeAttribute.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    productTypeId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'product_type_id' 
    },
    attributeId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'attribute_id' 
    },
    isRequired:{ 
      type:DataTypes.BOOLEAN,
      allowNull:false,
      field:'is_required', 
      defaultValue:false 
    },
    isVariant:{ 
      type:DataTypes.BOOLEAN,
      allowNull:false, 
      field:'is_variant', 
      defaultValue:false 
    },
    sortOrder:{ 
      type:DataTypes.INTEGER,
      allowNull:false,
      field:'sort_order', 
      defaultValue:0 
    }
  }, {
    sequelize,
    modelName: 'ProductTypeAttribute',
    tableName: 'product_type_attributes',
    underscored: true, 
    timestamps: true 
  });
  return ProductTypeAttribute;
};