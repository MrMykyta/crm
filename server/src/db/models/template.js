'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Template extends Model {
    static associate(models) {
      Template.hasMany(models.TemplateVersion, {
        as: 'versions',
        foreignKey: { name: 'templateId', field: 'template_id' },
        onDelete: 'CASCADE',
      });

      Template.hasOne(models.TemplateDraft, {
        as: 'draft',
        foreignKey: { name: 'templateId', field: 'template_id' },
        onDelete: 'CASCADE',
      });

      Template.belongsTo(models.TemplateVersion, {
        as: 'currentVersion',
        foreignKey: { name: 'currentVersionId', field: 'current_version_id' },
      });

      if (models.Company) {
        Template.belongsTo(models.Company, {
          as: 'company',
          foreignKey: { name: 'companyId', field: 'company_id' },
        });
      }

      if (models.User) {
        Template.belongsTo(models.User, {
          as: 'creator',
          foreignKey: { name: 'createdBy', field: 'created_by' },
        });
      }
    }
  }

  Template.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
      documentTypeKey: { type: DataTypes.STRING(64), allowNull: false, field: 'document_type_key' },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
      scope: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'custom' },
      currentVersionId: { type: DataTypes.UUID, allowNull: true, field: 'current_version_id' },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      sequelize,
      modelName: 'Template',
      tableName: 'templates',
      underscored: true,
      timestamps: true,
    }
  );

  return Template;
};
