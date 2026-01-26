'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Unified files table (replaces legacy attachments)
    await queryInterface.createTable('files', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'company_id',
      },
      ownerType: {
        type: Sequelize.ENUM(
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
      ownerId: {
        type: Sequelize.STRING(64),
        allowNull: false,
        field: 'owner_id',
      },
      purpose: {
        type: Sequelize.ENUM(
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
        type: Sequelize.ENUM('private', 'public'),
        allowNull: false,
        defaultValue: 'private',
      },
      publicKey: {
        type: Sequelize.STRING(128),
        allowNull: true,
        unique: true,
        field: 'public_key',
      },
      filename: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      safeName: {
        type: Sequelize.STRING(255),
        allowNull: false,
        field: 'safe_name',
      },
      mime: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      size: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      storagePath: {
        type: Sequelize.STRING(512),
        allowNull: false,
        field: 'storage_path',
      },
      uploadedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        field: 'uploaded_by',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        field: 'created_at',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at',
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    });

    await queryInterface.addIndex('files', ['company_id', 'owner_type', 'owner_id'], {
      name: 'idx_files_owner',
    });
    await queryInterface.addIndex('files', ['public_key'], {
      name: 'uniq_files_public_key',
      unique: true,
    });
    await queryInterface.addIndex('files', ['company_id', 'visibility'], {
      name: 'idx_files_visibility',
    });
    await queryInterface.addIndex('files', ['company_id', 'purpose'], {
      name: 'idx_files_purpose',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('files', 'idx_files_owner');
    await queryInterface.removeIndex('files', 'uniq_files_public_key');
    await queryInterface.removeIndex('files', 'idx_files_visibility');
    await queryInterface.removeIndex('files', 'idx_files_purpose');
    await queryInterface.dropTable('files');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_files_owner_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_files_purpose";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_files_visibility";');
  },
};
