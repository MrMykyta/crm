'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PriceList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PriceList.belongsTo(models.Company, { 
        foreignKey:'company_id', 
        as:'company' 
      });
      PriceList.hasMany(models.PriceListItem, { 
        foreignKey:'price_list_id', 
        as:'items' 
      });
    }
  }
  PriceList.init({
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
      type:DataTypes.STRING(64),
      allowNull:false
    }, 
    name:{
      type: DataTypes.STRING(160),
      allowNull:false
    }, 
    currency:{
      type: DataTypes.STRING(3),
      allowNull:false,
      defaultValue:'PLN'
    },
    type:{ 
      type:DataTypes.ENUM('base','b2b','b2c','promo','wholesale'),
      allowNull:false,
      defaultValue:'base'
    },
    isActive:{ 
      type:DataTypes.BOOLEAN,
      allowNull:false,
      field:'is_active', 
      defaultValue:true 
    },
    startAt:{ 
      type:DataTypes.DATE, 
      field:'start_at' 
    }, 
    endAt:{ 
      type:DataTypes.DATE, 
      field:'end_at' 
    }
  }, {
    sequelize,
    modelName: 'PriceList',
    tableName: 'price_lists',
    underscored: true,
    timestamps: true
  });
  return PriceList;
};