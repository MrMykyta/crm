'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Company extends Model {
    static associate(models) {
      Company.belongsTo(models.User, {
        foreignKey: { name: 'ownerUserId', field: 'owner_user_id' },
        as: 'owner',
      });

      Company.hasMany(models.UserCompany, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'memberships',
      });

      Company.belongsToMany(models.User, {
        through: models.UserCompany,
        foreignKey: { name: 'companyId', field: 'company_id' },
        otherKey:   { name: 'userId',    field: 'user_id'    },
        as: 'users',
      });

      // Контактные точки компании (полиморфно)
      Company.hasMany(models.ContactPoint, {
        foreignKey: { name: 'ownerId', field: 'owner_id' },
        scope: { ownerType: 'company' },
        constraints: false,
        as: 'contacts',
      });

      // Контактные ЛИЦА, принадлежащие компании (через контрагентов, но храним companyId в Contact)
      Company.hasMany(models.Contact, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'people',
      });

      Company.hasMany(models.UserPermission, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'userPermissions',
      });
    }
  }

  Company.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(200), allowNull: false },
      nip: { type: DataTypes.STRING(10), allowNull: true },
      regon: { type: DataTypes.STRING(14), allowNull: true },
      krs: { type: DataTypes.STRING(14), allowNull: true },
      bdo: { type: DataTypes.STRING(30), allowNull: true },
      website: { type: DataTypes.STRING(2048), allowNull: true },
      street: { type: DataTypes.STRING(128), allowNull: true },
      postalCode: { type: DataTypes.STRING(6), allowNull: true, field: 'postal_code' },
      city: { type: DataTypes.STRING(128), allowNull: true },
      country: { type: DataTypes.STRING(2), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      ownerUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        field: 'owner_user_id',
      },
      avatarUrl: { type: DataTypes.STRING(512), field: 'avatar_url', allowNull: true },
      createdAt: { type: DataTypes.DATE, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'Company',
      tableName: 'companies',
      underscored: true,
      timestamps: true,
    }
  );

  return Company;
};