'use strict';
const { Model } = require('sequelize');

// Unified Files model. This replaces legacy attachments and keeps all file metadata in one table.
module.exports = (sequelize, DataTypes) => {
  class File extends Model {
    static associate(models) {
      File.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploader' });
    }
  }

  File.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },

      // ownerType/ownerId связывают файл с бизнес-сущностью
      ownerType: {
        type: DataTypes.ENUM(
          'user',
          'company',
          'counterparty',
          'product',
          'deal',
          'task',
          'order',
          'offer',
          'contact',
          'department',
          'chatMessage',
          'brand'
        ),
        allowNull: false,
        field: 'owner_type',
      },
      // ownerId хранится строкой, т.к. часть ownerType живёт в Mongo (chatMessage = roomId)
      ownerId: { type: DataTypes.STRING(64), allowNull: false, field: 'owner_id' },

      // purpose — зачем файл нужен; visibility — кто может его получить
      purpose: {
        type: DataTypes.ENUM(
          'avatar',
          'background',
          'logo',
          'product_image',
          'website_asset',
          'chat_attachment',
          'document',
          'media',
          'other',
          'file'
        ),
        allowNull: false,
        defaultValue: 'file',
      },
      visibility: {
        type: DataTypes.ENUM('private', 'public'),
        allowNull: false,
        defaultValue: 'private',
      },
      publicKey: { type: DataTypes.STRING(128), allowNull: true, field: 'public_key' },

      filename: { type: DataTypes.STRING(255), allowNull: false },
      safeName: { type: DataTypes.STRING(255), allowNull: false, field: 'safe_name' },
      mime: { type: DataTypes.STRING(128), allowNull: false },
      size: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      storagePath: { type: DataTypes.STRING(512), allowNull: false, field: 'storage_path' },
      uploadedBy: { type: DataTypes.UUID, allowNull: false, field: 'uploaded_by' },

      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
    },
    {
      sequelize,
      modelName: 'File',
      tableName: 'files',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  return File;
};
