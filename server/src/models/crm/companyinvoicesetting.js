'use strict';

const { Model } = require('sequelize');
const {
  INVOICE_DEFAULT_TYPE_KEYS,
  INVOICE_PAYMENT_METHODS,
  INVOICE_PAYMENT_TERM_DAYS,
  INVOICE_CURRENCIES,
  INVOICE_STOCK_UPDATE_MODES,
  INVOICE_ANNOTATION_MODES,
} = require('../../services/crm/invoiceSettingsConfig');

module.exports = (sequelize, DataTypes) => {
  class CompanyInvoiceSetting extends Model {
    static associate(models) {
      CompanyInvoiceSetting.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
    }
  }

  CompanyInvoiceSetting.init(
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
      invoiceDefaultType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'invoice',
        field: 'invoice_default_type',
        validate: {
          isIn: [INVOICE_DEFAULT_TYPE_KEYS],
        },
      },
      invoiceDefaultPaymentMethod: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'bank_transfer',
        field: 'invoice_default_payment_method',
        validate: {
          isIn: [INVOICE_PAYMENT_METHODS],
        },
      },
      invoiceDefaultPaymentTermDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
        field: 'invoice_default_payment_term_days',
        validate: {
          isIn: [INVOICE_PAYMENT_TERM_DAYS],
        },
      },
      invoiceDefaultCurrency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'PLN',
        field: 'invoice_default_currency',
        validate: {
          isIn: [INVOICE_CURRENCIES],
        },
      },
      invoiceStockUpdateMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'disabled',
        field: 'invoice_stock_update_mode',
        validate: {
          isIn: [INVOICE_STOCK_UPDATE_MODES],
        },
      },
      invoiceAnnotationMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'empty',
        field: 'invoice_annotation_mode',
        validate: {
          isIn: [INVOICE_ANNOTATION_MODES],
        },
      },
      invoiceAnnotationTemplateHtml: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'invoice_annotation_template_html',
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
      modelName: 'CompanyInvoiceSetting',
      tableName: 'company_invoice_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return CompanyInvoiceSetting;
};

