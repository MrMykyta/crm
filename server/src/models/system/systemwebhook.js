'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SystemWebhook extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Webhook.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
      Webhook.hasMany(models.SystemWebhookDelivery, {
        foreignKey: 'webhook_id',
        as: 'deliveries',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
  });
    }
  }
  SystemWebhook.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey:true,
      allowNull:false, 
      defaultValue:DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    name: { 
      type: DataTypes.STRING(128), 
      allowNull:false 
    },
    url: { 
      type: DataTypes.TEXT, 
      allowNull:false 
    },
    secret: { 
      type: DataTypes.STRING(256), 
      allowNull:true 
    },
    isActive: { 
      type: DataTypes.BOOLEAN, 
      allowNull:false, 
      defaultValue:true, 
      field:'is_active' 
    },
    eventFilters: { 
      type: DataTypes.JSONB, 
      allowNull:true, 
      field:'event_filters' 
    },
    createdAt: { 
      type: DataTypes.DATE, 
      allowNull:false, 
      field:'created_at' 
    },
    updatedAt: { 
      type: DataTypes.DATE, 
      allowNull:false, 
      field:'updated_at' 
    },
    deletedAt: { 
      type: DataTypes.DATE, 
      allowNull:true, 
      field:'deleted_at' 
    }
  }, {
    sequelize,
    modelName: 'SystemWebhook',
    tableName:'system_webhooks', 
    timestamps:true, 
    paranoid:true,
    underscored: true
  });
  return SystemWebhook;
};