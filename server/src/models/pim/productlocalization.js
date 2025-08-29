'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductLocalization extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductLocalization.belongsTo(models.Product, { 
        foreignKey:'product_id', 
        as:'product' 
      });
    }
  }
  ProductLocalization.init({
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
    productId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'product_id' 
    },
    locale:{
      type: DataTypes.STRING(12),
      allowNull:false
    }, 
    slug:{
      type: DataTypes.STRING(320),
      allowNull:false
    }, 
    name:{
      type: DataTypes.STRING(255),
      allowNull:false
    },
    shortDescription:{ 
      type:DataTypes.TEXT, 
      field:'short_description' 
    },
    longDescription:{ 
      type:DataTypes.TEXT, 
      field:'long_description' 
    },
    seoTitle:{ 
      type:DataTypes.STRING, 
      field:'seo_title' 
    },
    seoDescription:{ 
      type:DataTypes.STRING, 
      field:'seo_description' 
    },
    seoKeywords:{ 
      type:DataTypes.STRING, 
      field:'seo_keywords' 
    }
  }, {
    sequelize,
    modelName: 'ProductLocalization',
    tableName: 'product_localizations',
    timestamps: true,
    underscored: true
  });
  return ProductLocalization;
};