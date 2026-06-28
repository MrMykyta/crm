'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CrmDealLostReason extends Model {
    static associate(models) {
      CrmDealLostReason.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  CrmDealLostReason.init({
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
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    archived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  }, {
    sequelize,
    modelName: 'CrmDealLostReason',
    tableName: 'crm_deal_lost_reasons',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  return CrmDealLostReason;
};
