'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TemplateDraft extends Model {
    static associate(models) {
      TemplateDraft.belongsTo(models.Template, {
        as: 'template',
        foreignKey: { name: 'templateId', field: 'template_id' },
      });

      if (models.User) {
        TemplateDraft.belongsTo(models.User, {
          as: 'updater',
          foreignKey: { name: 'updatedBy', field: 'updated_by' },
        });
      }
    }
  }

  TemplateDraft.init(
    {
      templateId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'template_id',
      },
      content: { type: DataTypes.JSONB, allowNull: false },
      schemaVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'schema_version' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
      updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
    },
    {
      sequelize,
      modelName: 'TemplateDraft',
      tableName: 'template_drafts',
      underscored: true,
      timestamps: false,
    }
  );

  return TemplateDraft;
};
