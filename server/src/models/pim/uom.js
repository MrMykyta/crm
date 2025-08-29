'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Uom extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Uom.belongsTo(models.Company, { 
        foreignKey: 'company_id', 
        as: 'company' 
      });
      Uom.hasMany(models.Product, { 
        foreignKey: 'uom_id', 
        as: 'products' 
      });
      Uom.hasMany(models.ProductVariant, { 
        foreignKey: 'uom_id', 
        as: 'variants' 
      });
    }
  }
  Uom.init({
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
    code: {
      type: DataTypes.STRING(32), 
      allowNull:false
    },
    name: {
      type: DataTypes.STRING(128), 
      allowNull:false
    },
    precision: {
      type: DataTypes.INTEGER, 
      allowNull:false, 
      defaultValue: 2 
    },
    isActive: { 
      type: DataTypes.BOOLEAN,
      allowNull: false, 
      field:'is_active', 
      defaultValue:true 
    }
  }, {
    sequelize,
    modelName: 'Uom',
    tableName: 'uoms',
    underscored: true, 
    timestamps: true
  });
  return Uom;
};