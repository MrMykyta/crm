'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Category.belongsTo(models.Company, { 
        foreignKey: 'company_id', 
        as: 'company' 
      });
      Category.belongsTo(models.Category, { 
        foreignKey: 'parent_id', 
        as: 'parent' 
      });
      Category.hasMany(models.Category, { 
        foreignKey: 'parent_id', 
        as: 'children' 
      });

      Category.belongsToMany(models.Product, {
        through: models.ProductCategory,
        foreignKey: 'category_id',
        otherKey: 'product_id',
        as: 'products'
      });
    }
  }
  Category.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey:true,
      allowNull:false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    parentId: { 
      type: DataTypes.UUID, 
      field:'parent_id' 
    },
    name: {
      type: DataTypes.STRING(160), 
      allowNull:false
    },
    slug: {
      type: DataTypes.STRING(200), 
      allowNull:false 
    },
    path: {
      type: DataTypes.STRING(1000), 
      allowNull:false 
    },
    description: {
      type: DataTypes.TEXT
    },
    isActive: { 
      type: DataTypes.BOOLEAN,
      allowNull: false, 
      field:'is_active', 
      defaultValue:true 
    },
    sortOrder: { 
      type: DataTypes.INTEGER,
      allowNull: false, 
      field:'sort_order', 
      defaultValue:0 
    }
  }, {
    sequelize,
    modelName: 'Category',
    tableName: 'categories',
    underscored: true,
    timestamps: true
  });
  return Category;
};