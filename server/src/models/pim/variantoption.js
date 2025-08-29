'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VariantOption extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      VariantOption.belongsTo(models.ProductVariant, { 
        foreignKey: 'variant_id', 
        as: 'variant' 
      });
    }
  }
  VariantOption.init({
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
    variantId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'variant_id' 
    },
    name: {
      type: DataTypes.STRING(64), 
      allowNull: false 
    },
    value: {
      type: DataTypes.STRING(160), 
      allowNull: false
    },
    sortOrder: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      field: 'sort_order', 
      defaultValue: 0 
    }
  }, {
    sequelize,
    modelName: 'VariantOption',
    tableName: 'variant_options',
    underscored: true, 
    timestamps: true  // adds createdAt and updatedAt fields automatically
  });
  return VariantOption;
};