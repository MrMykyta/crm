'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Attribute extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Attribute.belongsTo(models.Company, { 
        foreignKey: 'company_id', 
        as: 'company' 
      });
      Attribute.hasMany(models.AttributeOption, { 
        foreignKey: 'attribute_id', 
        as: 'options' 
      });
      Attribute.hasMany(models.ProductAttributeValue, { 
        foreignKey: 'attribute_id', 
        as: 'values' 
      });
    }
  }
  Attribute.init({
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
      type: DataTypes.STRING(64), 
      allowNull:false
    },
    name: {
      type: DataTypes.STRING(160), 
      allowNull:false
    },
    type: {
      type: DataTypes.ENUM('text','number','boolean','date','select','multiselect'),
      allowNull: false
    },
    isRequired: { 
      type: DataTypes.BOOLEAN,
      allowNull: false, 
      field:'is_required',
      defaultValue:false 
    },
    isVariant: { 
      type: DataTypes.BOOLEAN,
      allowNull: false, 
      field:'is_variant', 
      defaultValue:false 
    },
    unit: {
      type: DataTypes.STRING(32)
    }
  }, {
    sequelize,
    modelName: 'Attribute',
    tableName: 'attributes',
    underscored: true, 
    timestamps: true
  });
  return Attribute;
};