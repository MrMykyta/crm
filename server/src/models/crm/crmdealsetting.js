'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CrmDealSetting extends Model {
    static associate(models) {
      CrmDealSetting.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  CrmDealSetting.init({
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
    probabilityMode: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'automatic',
      field: 'probability_mode',
    },
    defaultCurrency: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'PLN',
      field: 'default_currency',
    },
    defaultExpectedCloseDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'default_expected_close_days',
    },
    visibility: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'company',
    },
    dealNumberingEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'deal_numbering_enabled',
    },
    dealNumberPrefix: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'deal_number_prefix',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  }, {
    sequelize,
    modelName: 'CrmDealSetting',
    tableName: 'crm_deal_settings',
    timestamps: true,
    underscored: true,
  });

  return CrmDealSetting;
};
