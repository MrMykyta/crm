'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductCollection extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductCollection.belongsTo(models.Product, { 
        foreignKey:'product_id' 
      });
      ProductCollection.belongsTo(models.Collection, { 
        foreignKey:'collection_id' 
      });
    }
  }
  ProductCollection.init({
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
    productId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'product_id' 
    },
    collectionId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'collection_id' 
    },
    sortOrder:{ 
      type:DataTypes.INTEGER, 
      field:'sort_order', 
      defaultValue:0 
    }
  }, {
    sequelize,
    modelName: 'ProductCollection',
    tableName: 'product_collections',
    underscored: true, 
    timestamps: true
  });
  return ProductCollection;
};