'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
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
    symbol: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    family: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'piece',
    },
    baseUnitCode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'base_unit_code',
      defaultValue: 'pcs',
    },
    factor: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 1,
    },
    precision: {
      type: DataTypes.INTEGER, 
      allowNull:false, 
      defaultValue: 2 
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'is_default',
      defaultValue: false,
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

