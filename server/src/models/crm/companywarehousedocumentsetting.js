'use strict';

const { Model } = require('sequelize');
const {
  WAREHOUSE_DOCUMENT_TYPE_KEYS,
} = require('../../services/crm/warehouseDocumentSettingsConfig');

module.exports = (sequelize, DataTypes) => {
  class CompanyWarehouseDocumentSetting extends Model {
    static associate(models) {
      CompanyWarehouseDocumentSetting.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
    }
  }

  CompanyWarehouseDocumentSetting.init(
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
      warehouseDefaultDocumentType: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'wz',
        field: 'warehouse_default_document_type',
        validate: {
          isIn: [WAREHOUSE_DOCUMENT_TYPE_KEYS],
        },
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
      modelName: 'CompanyWarehouseDocumentSetting',
      tableName: 'company_warehouse_document_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return CompanyWarehouseDocumentSetting;
};
