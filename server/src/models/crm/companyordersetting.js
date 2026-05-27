'use strict';

const { Model } = require('sequelize');
const {
  ORDER_PRODUCT_RESERVATION_MODES,
  ORDER_ANNOTATION_MODES,
} = require('../../services/crm/orderSettingsConfig');

module.exports = (sequelize, DataTypes) => {
  class CompanyOrderSetting extends Model {
    static associate(models) {
      CompanyOrderSetting.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
    }
  }

  CompanyOrderSetting.init(
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
      orderProductReservationMode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'disabled',
        field: 'order_product_reservation_mode',
        validate: {
          isIn: [ORDER_PRODUCT_RESERVATION_MODES],
        },
      },
      orderAnnotationMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'empty',
        field: 'order_annotation_mode',
        validate: {
          isIn: [ORDER_ANNOTATION_MODES],
        },
      },
      orderAnnotationTemplateHtml: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'order_annotation_template_html',
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
      modelName: 'CompanyOrderSetting',
      tableName: 'company_order_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return CompanyOrderSetting;
};
