'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Channel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Channel.belongsTo(models.Company, { 
        foreignKey:'company_id', 
        as:'company' 
      });
      Channel.hasMany(models.ChannelListing, { 
        foreignKey:'channel_id', 
        as:'listings' 
      });
      Channel.hasMany(models.ChannelCategoryMap, { 
        foreignKey:'channel_id', 
        as:'categoryMaps' 
      });
    }
  }
  Channel.init({
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
      allowNull:false
    }, 
    name:{
      type: DataTypes.STRING(160),
      allowNull:false
    },
    type:{ 
      type:DataTypes.ENUM('shop','marketplace','b2b','feed','custom'),
      allowNull:false, 
      defaultValue:'shop' 
    },
    isActive:{ 
      type:DataTypes.BOOLEAN, 
      field:'is_active',
      allowNull:false, 
      defaultValue:true 
    },
    createdAt:{
      type: DataTypes.DATE, 
      field:'created_at',
      allowNull:false, 
      defaultValue: DataTypes.NOW
      },
    updatedAt:{
      type: DataTypes.DATE, 
      field:'updated_at',
      allowNull:false, 
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'Channel',
    tableName: 'channels',
    underscored: true, 
    timestamps: true
  });
  return Channel;
};