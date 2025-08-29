'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductTag extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      ProductTag.belongsTo(models.Product, { 
        foreignKey:'product_id' 
      });
      ProductTag.belongsTo(models.Tag, { 
        foreignKey:'tag_id' 
      });
    }
  }
  ProductTag.init({
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
    tagId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'tag_id' 
    }
  }, {
    sequelize,
    modelName: 'ProductTag',
    tableName: 'product_tags',
    underscored: true,
    timestamps: true
  });
  return ProductTag;
};