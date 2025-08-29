'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductCategory extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductCategory.belongsTo(models.Product, { 
        foreignKey: 'product_id' 
      });
      ProductCategory.belongsTo(models.Category, { 
        foreignKey: 'category_id' 
      });
    }
  }
  ProductCategory.init({
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
    categoryId:{ 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'category_id' 
    }
  }, {
    sequelize,
    modelName: 'ProductCategory',
    tableName: 'product_categories',
    underscored: true,
    timestamps: true
  });
  return ProductCategory;
};