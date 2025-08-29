'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Brand extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Brand.belongsTo(models.Company, { 
        foreignKey: 'company_id', 
        as: 'company' 
      });
      Brand.hasMany(models.Product, { 
        foreignKey: 'brand_id', 
        as: 'products' 
      });
    }
  }
  Brand.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    name: {
      type: DataTypes.STRING(128), 
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(160), 
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    logoUrl: { 
      type: DataTypes.STRING(512), 
      field:'logo_url' 
    },
    isActive: { 
      type: DataTypes.BOOLEAN,
      allowNull: false, 
      field:'is_active', 
      defaultValue:true 
    }
  }, {
    sequelize,
    modelName: 'Brand',
    tableName: 'brands',
    underscored: true, 
    timestamps: true
  });
  return Brand;
};