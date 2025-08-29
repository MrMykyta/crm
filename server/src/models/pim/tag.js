'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Tag extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Tag.belongsTo(models.Company, { 
        foreignKey:'company_id', 
        as:'company' 
      });
      Tag.belongsToMany(models.Product, {
        through: models.ProductTag, 
        foreignKey:'tag_id', 
        otherKey:'product_id', 
        as:'products'
      });
    }
  }
  Tag.init({
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
    isActive:{ 
      type:DataTypes.BOOLEAN,
      allowNull:false,
      field:'is_active', 
      defaultValue:true 
    }
  }, {
    sequelize,
    modelName: 'Tag',
    tableName: 'tags',
    underscored: true, 
    timestamps: true
  });
  return Tag;
};