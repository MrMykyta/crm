'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ChannelCategoryMap extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ChannelCategoryMap.belongsTo(models.Channel, { 
        foreignKey:'channel_id', 
        as:'channel' 
      });
      ChannelCategoryMap.belongsTo(models.Category,{ 
        foreignKey:'category_id', 
        as:'category' 
      });
    }
  }
  ChannelCategoryMap.init({
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
    categoryId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'category_id' 
    },
    externalCategoryId:{ 
      type:DataTypes.STRING(160), 
      allowNull:false, 
      field:'external_category_id' 
    },
    externalPath:{ 
      type:DataTypes.STRING(1000), 
      field:'external_path' 
    }
  }, {
    sequelize,
    modelName: 'ChannelCategoryMap',
    tableName: 'channel_category_maps',
    underscored: true,
    timestamps: true
  });
  return ChannelCategoryMap;
};