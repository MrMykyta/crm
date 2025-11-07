'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Counterparty extends Model {
    static associate(models) {
      Counterparty.belongsTo(models.Company, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'company',
      });

      Counterparty.belongsTo(models.User, {
        foreignKey: { name: 'mainResponsibleUserId', field: 'main_responsible_user_id' },
        as: 'responsible',
      });

      // аудит
      Counterparty.belongsTo(models.User, { foreignKey: { name: 'createdBy', field: 'created_by' }, as: 'creator' });
      Counterparty.belongsTo(models.User, { foreignKey: { name: 'updatedBy', field: 'updated_by' }, as: 'updater' });

      // холдинг (self-reference)
      Counterparty.belongsTo(models.Counterparty, { foreignKey: { name: 'holdingId', field: 'holding_id' }, as: 'holding' });
      Counterparty.hasMany(models.Counterparty, { foreignKey: { name: 'holdingId', field: 'holding_id' }, as: 'subsidiaries' });

      // Контактные точки контрагента (полиморфно)
      Counterparty.hasMany(models.ContactPoint, {
        foreignKey: { name: 'ownerId', field: 'owner_id' },
        scope: { owner_type: 'counterparty' },
        constraints: false,
        as: 'contacts',
      });

      // Контактные ЛИЦА контрагента
      Counterparty.hasMany(models.Contact, {
        foreignKey: { name: 'counterpartyId', field: 'counterparty_id' },
        as: 'people',
      });
    }
  }

  Counterparty.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
      holdingId: { type: DataTypes.UUID, allowNull: true, field: 'holding_id' },
      departmentId: { type: DataTypes.UUID, allowNull: true, field: 'department_id' },
      mainResponsibleUserId: { type: DataTypes.UUID, allowNull: true, field: 'main_responsible_user_id' },
      firstName: { type: DataTypes.STRING(100), allowNull: true, field: 'first_name' },
      lastName: { type: DataTypes.STRING(100), allowNull: true, field: 'last_name' },
      fullName: { type: DataTypes.STRING(200), allowNull: true, field: 'full_name' },
      shortName: { type: DataTypes.STRING(200), allowNull: false, field: 'short_name' },
      nip: { type: DataTypes.STRING(10), allowNull: true },
      regon: { type: DataTypes.STRING(14), allowNull: true },
      krs: { type: DataTypes.STRING(14), allowNull: true },
      bdo: { type: DataTypes.STRING(30), allowNull: true },
      type: {
        type: DataTypes.ENUM('lead', 'client', 'partner', 'supplier', 'manufacturer'),
        allowNull: false,
        defaultValue: 'lead',
      },
      status: {
        type: DataTypes.ENUM('potential', 'active', 'inactive'),
        allowNull: false,
        defaultValue: 'potential',
      },
      country: { type: DataTypes.STRING(2), allowNull: true },
      city: { type: DataTypes.STRING(128), allowNull: true },
      postalCode: { type: DataTypes.STRING(12), allowNull: true, field: 'postal_code' },
      street: { type: DataTypes.STRING(128), allowNull: true },
      isCompany: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_company' },
      description: { type: DataTypes.TEXT, allowNull: true },
      avatarUrl: { type: DataTypes.STRING(512), field: 'avatar_url', allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
      updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'Counterparty',
      tableName: 'counterparties',
      underscored: true,
      timestamps: true,
    }
  );

  return Counterparty;
};