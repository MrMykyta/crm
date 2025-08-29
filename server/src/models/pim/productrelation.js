'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductRelation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductRelation.belongsTo(models.Product, { 
        foreignKey:'source_product_id', 
        as:'source' 
      });
      ProductRelation.belongsTo(models.Product, { 
        foreignKey:'target_product_id', 
        as:'target' 
      });
    }
  }
  ProductRelation.init({
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
    sourceProductId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'source_product_id' 
    },
    targetProductId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'target_product_id' 
    },
    relationType:{ 
      type:DataTypes.ENUM('related','upsell','cross_sell','accessory','replacement','similar'), 
      allowNull: false, 
      field:'relation_type' 
    }
  }, {
    sequelize,
    modelName: 'ProductRelation',
    tableName: 'product_relations',
    underscored: true,
    timestamps: true
  });
  return ProductRelation;
};