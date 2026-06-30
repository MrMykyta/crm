'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CrmDealActivity extends Model {
    static associate(models) {
      CrmDealActivity.belongsTo(models.Company, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'company',
      });
      CrmDealActivity.belongsTo(models.Deal, {
        foreignKey: { name: 'dealId', field: 'deal_id' },
        as: 'deal',
      });
      CrmDealActivity.belongsTo(models.User, {
        foreignKey: { name: 'authorId', field: 'author_id' },
        as: 'author',
      });
    }
  }

  CrmDealActivity.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id',
    },
    dealId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'deal_id',
    },
    type: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'occurred_at',
      defaultValue: DataTypes.NOW,
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'author_id',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  }, {
    sequelize,
    modelName: 'CrmDealActivity',
    tableName: 'crm_deal_activities',
    underscored: true,
    timestamps: true,
    paranoid: true,
  });

  return CrmDealActivity;
};
