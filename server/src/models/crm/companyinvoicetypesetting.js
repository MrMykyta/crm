'use strict';

const { Model } = require('sequelize');
const { INVOICE_DEFAULT_TYPE_KEYS } = require('../../services/crm/invoiceSettingsConfig');

module.exports = (sequelize, DataTypes) => {
  class CompanyInvoiceTypeSetting extends Model {
    static associate(models) {
      CompanyInvoiceTypeSetting.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
    }
  }

  CompanyInvoiceTypeSetting.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      typeKey: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: 'type_key',
        validate: {
          isIn: [INVOICE_DEFAULT_TYPE_KEYS],
        },
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      modelName: 'CompanyInvoiceTypeSetting',
      tableName: 'company_invoice_type_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return CompanyInvoiceTypeSetting;
};

