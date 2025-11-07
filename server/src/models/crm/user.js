'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Company, { foreignKey: { name: 'ownerUserId', field: 'owner_user_id' }, as: 'owned_companies' });

      User.hasMany(models.UserCompany, { foreignKey: { name: 'userId', field: 'user_id' }, as: 'memberships' });

      User.belongsToMany(models.Company, {
        through: models.UserCompany,
        foreignKey: { name: 'userId', field: 'user_id' },
        otherKey:   { name: 'companyId', field: 'company_id' },
        as: 'companies',
      });

      // Контактные точки пользователя (полиморфно)
      User.hasMany(models.ContactPoint, {
        foreignKey: { name: 'ownerId', field: 'owner_id' },
        scope: { ownerType: 'user' },
        constraints: false,
        as: 'contacts',
      });

      User.belongsToMany(models.Role, {
        through: models.UserRole,
        foreignKey: 'userId',
        otherKey: 'roleId',
        as: 'roles',
      });

      User.hasMany(models.UserRole, { foreignKey: 'userId', as: 'userRoles' });

      User.belongsToMany(models.Permission, {
        through: models.UserPermission,
        foreignKey: 'userId',
        otherKey: 'permissionId',
        as: 'permissions',
      });

      User.hasMany(models.UserPermission, { foreignKey: 'userId', as: 'userPermissions' });

      // Задачи, где пользователь — исполнитель (pivot task_assignments)
      User.belongsToMany(models.Task, {
        as: 'assignedTasks',
        through: 'task_user_participants',
        foreignKey: { name: 'userId', field: 'user_id' },
        otherKey:   { name: 'taskId', field: 'task_id' },
      });

      // Контактные ЛИЦА, за которые пользователь ответственен
      User.hasMany(models.Contact, {
        foreignKey: { name: 'mainResponsibleUserId', field: 'main_responsible_user_id' },
        as: 'responsibleContacts',
      });
    }
  }

  User.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
      passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
      firstName: { type: DataTypes.STRING, allowNull: true, field: 'first_name' },
      lastName: { type: DataTypes.STRING, allowNull: true, field: 'last_name' },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
      lastLoginAt: { type: DataTypes.DATE, field: 'last_login_at', allowNull: true },
      verificationToken: { type: DataTypes.STRING(128), field: 'verification_token', allowNull: true },
      verificationExpiresAt: { type: DataTypes.DATE, field: 'verification_expires_at', allowNull: true },
      emailVerifiedAt: { type: DataTypes.DATE, field: 'email_verified_at', allowNull: true },
      avatarUrl: { type: DataTypes.STRING(512), field: 'avatar_url', allowNull: true },
      backgroundUrl: { type: DataTypes.STRING(512), field: 'background_url', allowNull: true },
      createdBy: { type: DataTypes.UUID, field: 'created_by', allowNull: true, defaultValue: null },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      paranoid: true,
      underscored: true,
      timestamps: true,
    }
  );

  return User;
};