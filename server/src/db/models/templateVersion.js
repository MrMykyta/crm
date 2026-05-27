'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TemplateVersion extends Model {
    static associate(models) {
      TemplateVersion.belongsTo(models.Template, {
        as: 'template',
        foreignKey: { name: 'templateId', field: 'template_id' },
      });

      TemplateVersion.hasOne(models.TemplateVersionContent, {
        as: 'contentRecord',
        foreignKey: { name: 'templateVersionId', field: 'template_version_id' },
        onDelete: 'CASCADE',
      });

      if (models.User) {
        TemplateVersion.belongsTo(models.User, {
          as: 'publisher',
          foreignKey: { name: 'publisherId', field: 'publisher_id' },
        });
      }
    }
  }

  TemplateVersion.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false, field: 'version_number' },
      schemaVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'schema_version' },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'published' },
      contentHash: { type: DataTypes.STRING(128), allowNull: false, field: 'content_hash' },
      publisherId: { type: DataTypes.UUID, allowNull: true, field: 'publisher_id' },
      publishedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'published_at' },
      changelog: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'TemplateVersion',
      tableName: 'template_versions',
      underscored: true,
      timestamps: false,
    }
  );

  return TemplateVersion;
};
