'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TemplateVersionContent extends Model {
    static associate(models) {
      TemplateVersionContent.belongsTo(models.TemplateVersion, {
        as: 'version',
        foreignKey: { name: 'templateVersionId', field: 'template_version_id' },
      });
    }
  }

  TemplateVersionContent.init(
    {
      templateVersionId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: 'template_version_id',
      },
      content: { type: DataTypes.JSONB, allowNull: false },
    },
    {
      sequelize,
      modelName: 'TemplateVersionContent',
      tableName: 'template_version_content',
      underscored: true,
      timestamps: false,
    }
  );

  return TemplateVersionContent;
};
