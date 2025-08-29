'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductType extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductType.belongsTo(models.Company, { 
        foreignKey:'company_id', 
        as:'company' 
      });
      ProductType.hasMany(models.ProductTypeAttribute, { 
        foreignKey:'product_type_id', 
        as:'attributes' 
      });
      ProductType.hasMany(models.Product, { 
        foreignKey:'product_type_id', 
        as:'products' 
      });
    }
  }
  ProductType.init({
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
    code:{
      type: DataTypes.STRING(64),
      allowNull: false
    }, 
    name:{
      type: DataTypes.STRING(160),
      allowNull: false
    }, 
    description:{ 
      type: DataTypes.TEXT
    },
    isActive:{ 
      type:DataTypes.BOOLEAN,
      allowNull:false, 
      field:'is_active', 
      defaultValue:true 
    }
  }, {
    sequelize,
    modelName: 'ProductType',
    tableName: 'product_types',
    underscored: true, 
    timestamps: true
  });
  return ProductType;
};