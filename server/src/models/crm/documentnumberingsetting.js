'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DocumentNumberingSetting extends Model {
    static associate(models) {
      DocumentNumberingSetting.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
    }
  }

  DocumentNumberingSetting.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
      documentType: { type: DataTypes.STRING(32), allowNull: false, field: 'document_type' },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      pattern: { type: DataTypes.STRING(180), allowNull: false, defaultValue: 'DOC/{YYYY}/{SEQ:4}' },
      sequenceCounter: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sequence_counter' },
      lastNumber: { type: DataTypes.STRING(180), allowNull: true, field: 'last_number' },
      resetPolicy: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'yearly', field: 'reset_policy' },
      lastGeneratedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_generated_at' },
      lastResetToken: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '', field: 'last_reset_token' },

      // Legacy fields (kept for backwards compatibility with previous releases).
      prefix: { type: DataTypes.STRING(32), allowNull: false },
      formatPreset: { type: DataTypes.STRING(64), allowNull: false, field: 'format_preset' },
      resetPeriod: { type: DataTypes.STRING(16), allowNull: false, field: 'reset_period' },
      startNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'start_number' },
      currentNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'current_number' },
      isAutoEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_auto_enabled' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      sequelize,
      modelName: 'DocumentNumberingSetting',
      tableName: 'document_numbering_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return DocumentNumberingSetting;
};
