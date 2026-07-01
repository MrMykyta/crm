'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class CreditNote extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      CreditNote.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });
      CreditNote.belongsTo(models.Invoice, { 
        as: 'invoice', 
        foreignKey: 'invoiceId' 
      });
      CreditNote.belongsTo(models.Order, {
        as: 'order',
        foreignKey: 'orderId',
      });
      CreditNote.hasMany(models.CreditNoteApplication, {
        as: 'applications',
        foreignKey: 'creditNoteId',
        onDelete: 'CASCADE',
      });
    }
  }
  CreditNote.init({
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
    invoiceId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'invoice_id' 
    },
    amountNet: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false, 
      field: 'amount_net' 
    },
    amountTax: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false, 
      field: 'amount_tax' 
    },
    amountGross: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false, 
      field: 'amount_gross' 
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: true,
      defaultValue: 'issued',
    },
    number: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'issued_at',
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'order_id',
    },
    reason: { 
      type: DataTypes.STRING(256) 
    },
  }, {
    sequelize,
    modelName: 'CreditNote',
    tableName: 'credit_notes',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return CreditNote;
};
