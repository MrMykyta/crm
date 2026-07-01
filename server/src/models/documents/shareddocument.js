'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SharedDocument extends Model {
    static associate(models) {
      SharedDocument.belongsTo(models.Company, {
        as: 'company',
        foreignKey: 'companyId',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      SharedDocument.belongsTo(models.Document, {
        as: 'document',
        foreignKey: 'documentId',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      SharedDocument.belongsTo(models.File, {
        as: 'file',
        foreignKey: 'fileId',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      SharedDocument.belongsTo(models.User, {
        as: 'generator',
        foreignKey: 'generatedBy',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }

  SharedDocument.init({
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
    documentId: { type: DataTypes.UUID, allowNull: false, field: 'document_id' },
    fileId: { type: DataTypes.UUID, allowNull: true, field: 'file_id' },
    sourceEntityType: { type: DataTypes.STRING(64), allowNull: false, field: 'source_entity_type' },
    sourceEntityId: { type: DataTypes.UUID, allowNull: false, field: 'source_entity_id' },
    token: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
    expiresAt: { type: DataTypes.DATE, allowNull: true, field: 'expires_at' },
    revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
    viewCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'view_count' },
    downloadCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'download_count' },
    generatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'generated_at' },
    generatedBy: { type: DataTypes.UUID, allowNull: true, field: 'generated_by' },
    templateVersionId: { type: DataTypes.UUID, allowNull: true, field: 'template_version_id' },
    renderDtoSnapshot: { type: DataTypes.JSONB, allowNull: false, field: 'render_dto_snapshot' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    modelName: 'SharedDocument',
    tableName: 'shared_documents',
    underscored: true,
    timestamps: true,
  });

  return SharedDocument;
};
