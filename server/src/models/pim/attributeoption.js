'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AttributeOption extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      AttributeOption.belongsTo(models.Company, { 
        foreignKey: 'company_id', 
        as: 'company' 
      });
      AttributeOption.belongsTo(models.Attribute, { 
        foreignKey: 'attribute_id', 
        as: 'attribute' 
      });
    }
  }
  AttributeOption.init({
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
    attributeId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'attribute_id' 
    },
    value: {
      type: DataTypes.STRING(160), 
      allowNull:false
    },
    sortOrder: { 
      type: DataTypes.INTEGER,
      allowNull: false,
      field:'sort_order', 
      defaultValue:0
    }
  }, {
    sequelize,
    modelName: 'AttributeOption',
    tableName: 'attribute_options',
    underscored: true, 
    timestamps: true
  });
  return AttributeOption;
};