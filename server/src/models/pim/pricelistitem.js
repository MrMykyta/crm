'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PriceListItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PriceListItem.belongsTo(models.PriceList, { 
        foreignKey:'price_list_id', 
        as:'priceList' 
      });
      PriceListItem.belongsTo(models.Product, { 
        foreignKey:'product_id',   
        as:'product' 
      });
      PriceListItem.belongsTo(models.ProductVariant, { 
        foreignKey:'variant_id', 
        as:'variant' 
      });
    }
  }
  PriceListItem.init({
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
    priceListId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'price_list_id' 
    },
    productId:{ 
      type:DataTypes.UUID, 
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    minQty:{ 
      type:DataTypes.INTEGER,
      allowNull:false,
      field:'min_qty', 
      defaultValue:1 
    },
    price:{ 
      type:DataTypes.DECIMAL(14,2), 
      allowNull:false,
      defaultValue:0, 
    }
  }, {
    sequelize,
    modelName: 'PriceListItem',
    tableName: 'price_list_items',
    underscored: true,
    timestamps: true
  });
  return PriceListItem;
};