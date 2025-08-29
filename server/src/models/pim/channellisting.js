'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ChannelListing extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      ChannelListing.belongsTo(models.Channel, { 
        foreignKey:'channel_id', 
        as:'channel' 
      });
      ChannelListing.belongsTo(models.Product, { 
        foreignKey:'product_id', 
        as:'product' 
      });
      ChannelListing.belongsTo(models.ProductVariant, { 
        foreignKey:'variant_id', 
        as:'variant' 
      });
    }
  }
  ChannelListing.init({
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
    channelId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'channel_id' 
    },
    productId:{ 
      type:DataTypes.UUID, 
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    state:{ 
      type:DataTypes.ENUM('draft','ready','published','archived','error'), 
      allowNull:false, 
      defaultValue:'draft' 
    },
    channelSku:{ 
      type:DataTypes.STRING(128), 
      field:'channel_sku' 
    },
    currency:{
      type: DataTypes.STRING(3),
      defaultValue:'PLN'
    }, 
    price:{
      type: DataTypes.DECIMAL(14,2),
      defaultValue:0
    },
    title:{
      type: DataTypes.STRING(255)
    }, 
    description:{
      type: DataTypes.TEXT
    }, 
    data:{
      type: DataTypes.JSONB
    }
  }, {
    sequelize,
    modelName: 'ChannelListing',
    tableName: 'channel_listings',
    underscored: true,
    timestamps: true
  });
  return ChannelListing;
};