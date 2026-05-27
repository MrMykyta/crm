'use strict';

const { Model } = require('sequelize');
const { OFFER_ANNOTATION_MODES } = require('../../services/crm/offerSettingsConfig');

module.exports = (sequelize, DataTypes) => {
  class CompanyOfferSetting extends Model {
    static associate(models) {
      CompanyOfferSetting.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
    }
  }

  CompanyOfferSetting.init(
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
      offerAnnotationMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'empty',
        field: 'offer_annotation_mode',
        validate: {
          isIn: [OFFER_ANNOTATION_MODES],
        },
      },
      offerAnnotationTemplateHtml: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'offer_annotation_template_html',
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
      modelName: 'CompanyOfferSetting',
      tableName: 'company_offer_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return CompanyOfferSetting;
};
