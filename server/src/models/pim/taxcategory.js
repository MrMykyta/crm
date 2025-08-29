'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TaxCategory extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      TaxCategory.belongsTo(models.Company, { 
        foreignKey:'company_id', 
        as:'company' 
      });
      TaxCategory.hasMany(models.Product, { 
        foreignKey:'tax_category_id', 
        as:'products' 
      });
    }
  }
  TaxCategory.init({
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
    rate:{
      type: DataTypes.DECIMAL(5,2), 
      allowNull:false, 
      defaultValue:23.00 
    },
    isActive:{ 
      type:DataTypes.BOOLEAN,
      allowNull:false,
      field:'is_active', 
      defaultValue:true 
    }
  }, {
    sequelize,
    modelName: 'TaxCategory',
    tableName: 'tax_categories',
    underscored: true, 
    timestamps: true
  });
  return TaxCategory;
};