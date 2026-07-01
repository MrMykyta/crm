'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Payment.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });
      
      Payment.belongsTo(models.Order, { 
        as: 'order', 
        foreignKey: 'orderId' 
      });

      Payment.hasMany(models.PaymentApplication, {
        as: 'applications',
        foreignKey: 'paymentId',
        onDelete: 'CASCADE',
      });
    }
  }
  Payment.init({
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
    method: { 
      type: DataTypes.ENUM('card','bank_transfer','cash','cod','paypal','stripe','other'), 
      allowNull: false 
    },
    status: { 
      type: DataTypes.ENUM('pending','authorized','paid','failed','refunded'), 
      defaultValue: 'pending' 
    },
    amount: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false 
    },
    direction: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'inbound',
      validate: {
        isIn: [['inbound', 'refund']],
      },
    },
    currencyCode: {
      type: DataTypes.STRING(3),
      allowNull: true,
      field: 'currency_code',
    },
    reference: {
      type: DataTypes.STRING(256),
      allowNull: true,
    },
    transactionId: { 
      type: DataTypes.STRING(128), 
      field: 'transaction_id' 
    },
    processedAt: { 
      type: DataTypes.DATE, 
      field: 'processed_at' 
    },
  }, {
    sequelize,
    modelName: 'Payment',
    tableName: 'payments',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return Payment;
};
