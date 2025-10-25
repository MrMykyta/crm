'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      email: {
        type: Sequelize.STRING(200),
        unique: true,
        allowNull: false
      },
      passwordHash: {
        type: Sequelize.STRING(200),
        field: 'password_hash',
        allowNull: false
      },
      firstName: {
        type: Sequelize.STRING(200),
        field: 'first_name',
        allowNull: true
      },
      lastName: {
        type: Sequelize.STRING(200),
        field: 'last_name',
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        field: 'is_active',
        defaultValue: true
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        field: 'last_login_at',
        allowNull: true
      },
      createdBy: {
        type: Sequelize.UUID,
        field: 'created_by',
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
          },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        defaultValue: null
      },
      avatarUrl: {
        type: Sequelize.STRING(512),
        field: 'avatar_url',
        allowNull: true
      },
      backgroundUrl: {
        type: Sequelize.STRING(512),
        field: 'background_url',
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        field: 'created_at',
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        field: 'updated_at',
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      deletedAt: {
        type: Sequelize.DATE,
        field: 'deleted_at',
        allowNull: true
      }
    });

    await queryInterface.addConstraint('users', {
      fields: ['email'],
      type: 'unique',
      name: 'uniq_users_email'
    });

    await queryInterface.addIndex('users', ['created_at'], {
      name: 'users_created_at_index',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('companies', 'users_email_uindex');
    await queryInterface.removeIndex('companies', 'users_created_at_index');

    await queryInterface.dropTable('users');
  }
};