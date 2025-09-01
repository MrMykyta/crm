'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SystemWebhookDelivery extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SystemWebhookDelivery.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });

      SystemWebhookDelivery.belongsTo(models.SystemWebhook, {
        foreignKey: 'webhook_id',
        as: 'webhook',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });

      // Хотим связь на событие — можно (если часто нужен join)
      SystemWebhookDelivery.belongsTo(models.SystemEvent, {
        foreignKey: 'event_id',
        as: 'event',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  SystemWebhookDelivery.init({
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
    webhookId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'webhook_id' 
    },
    eventId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'event_id' 
    },
    status: { 
      type: DataTypes.ENUM('pending','success','failed'), 
      allowNull:false, 
      defaultValue:'pending' 
    },
    attempt: { 
      type: DataTypes.INTEGER, 
      allowNull:false, 
      defaultValue:0 
    },
    nextAttemptAt: { 
      type: DataTypes.DATE, 
      allowNull:true, 
      field:'next_attempt_at' 
    },
    responseCode: { 
      type: DataTypes.INTEGER, 
      allowNull:true, 
      field:'response_code' 
    },
    errorMessage: { 
      type: DataTypes.TEXT, 
      allowNull:true, 
      field:'error_message' 
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
    }
  }, {
    sequelize,
    modelName: 'SystemWebhookDelivery',
    tableName:'system_webhook_deliveries', 
    timestamps:true,
    underscored: true
  });
  return SystemWebhookDelivery;
};