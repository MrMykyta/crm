'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductAttributeValue extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductAttributeValue.belongsTo(models.Product, { 
        foreignKey: 'product_id', 
        as: 'product' 
      });
      ProductAttributeValue.belongsTo(models.Attribute, { 
        foreignKey: 'attribute_id', 
        as: 'attribute' 
      });
    }
  }
  ProductAttributeValue.init({
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
    attributeId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'attribute_id' 
    },
    valueText: { 
      type: DataTypes.TEXT, 
      field:'value_text' 
    },
    valueNumber: { 
      type: DataTypes.DECIMAL(18,6), 
      field:'value_number' 
    },
    valueBoolean: { 
      type: DataTypes.BOOLEAN, 
      field:'value_boolean' 
    },
    valueDate: { 
      type: DataTypes.DATE, 
      field:'value_date' 
    },
    valueJson: { 
      type: DataTypes.JSONB, 
      field:'value_json' 
    }
  }, {
    sequelize,
    modelName: 'ProductAttributeValue',
    tableName: 'product_attribute_values',
    underscored: true,
    timestamps: true
  });
  return ProductAttributeValue;
};