'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CreditNoteApplication extends Model {
    static associate(models) {
      CreditNoteApplication.belongsTo(models.Company, {
        as: 'company',
        foreignKey: 'companyId',
      });
      CreditNoteApplication.belongsTo(models.CreditNote, {
        as: 'creditNote',
        foreignKey: 'creditNoteId',
      });
      CreditNoteApplication.belongsTo(models.Invoice, {
        as: 'invoice',
        foreignKey: 'invoiceId',
      });
      CreditNoteApplication.belongsTo(models.User, {
        as: 'creator',
        foreignKey: 'createdBy',
      });
    }
  }

  CreditNoteApplication.init({
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
    creditNoteId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'credit_note_id',
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
    modelName: 'CreditNoteApplication',
    tableName: 'credit_note_applications',
    underscored: true,
    timestamps: true,
    paranoid: true,
  });

  return CreditNoteApplication;
};
