'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ShippingClass extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      ShippingClass.belongsTo(models.Company, { 
        foreignKey:'company_id', 
        as:'company' 
      });
      ShippingClass.hasMany(models.Product, { 
        foreignKey:'shipping_class_id', 
        as:'products' 
      });
    }
  }
  ShippingClass.init({
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
      type: DataTypes.STRING(32), 
      allowNull:false 
    }, 
    name:{
      type: DataTypes.STRING(160), 
      allowNull:false
    },
    isActive:{ 
      type:DataTypes.BOOLEAN,
      allowNull:false,
      field:'is_active', 
      defaultValue:true 
    }
  }, {
    sequelize,
    modelName: 'ShippingClass',
    tableName:'shipping_classes',
    underscored: true, 
    timestamps: true
  });
  return ShippingClass;
};