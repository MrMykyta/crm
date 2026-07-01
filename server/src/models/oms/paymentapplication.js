'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PaymentApplication extends Model {
    static associate(models) {
      PaymentApplication.belongsTo(models.Company, {
        as: 'company',
        foreignKey: 'companyId',
      });
      PaymentApplication.belongsTo(models.Payment, {
        as: 'payment',
        foreignKey: 'paymentId',
      });
      PaymentApplication.belongsTo(models.Invoice, {
        as: 'invoice',
        foreignKey: 'invoiceId',
      });
      PaymentApplication.belongsTo(models.User, {
        as: 'creator',
        foreignKey: 'createdBy',
      });
    }
  }

  PaymentApplication.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id',
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'payment_id',
    },
    invoiceId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'invoice_id',
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    allocatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'allocated_at',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
    },
  }, {
    sequelize,
    modelName: 'PaymentApplication',
    tableName: 'payment_applications',
    underscored: true,
    timestamps: true,
    paranoid: true,
  });

  return PaymentApplication;
};
