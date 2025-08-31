'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OrderEvent extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      OrderEvent.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });
      OrderEvent.belongsTo(models.Order, { 
        as: 'order', 
        foreignKey: 'orderId' 
      });
      OrderEvent.belongsTo(models.User, { 
        as: 'actor', 
        foreignKey: 'actorId' 
      });
    }
  }
  OrderEvent.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      allowNull: false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'company_id' 
    },
    orderId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'order_id' 
    },
    actorId: { 
      type: DataTypes.UUID, 
      field: 'actor_id' 
    },
    type: { 
      type: DataTypes.ENUM('status_change','payment','shipment','refund','note_added','other'), 
      allowNull: false 
    },
    message: { 
      type: DataTypes.TEXT 
    },
  }, {
    sequelize,
    modelName: 'OrderEvent',
    tableName: 'order_events',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return OrderEvent;
};