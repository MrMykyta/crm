'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Contact extends Model {
    static associate(models) {
      Contact.belongsTo(models.Company, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'company',
      });
      Contact.belongsTo(models.Counterparty, {
        foreignKey: { name: 'counterpartyId', field: 'counterparty_id' },
        as: 'counterparty',
      });
      Contact.belongsTo(models.User, {
        foreignKey: { name: 'mainResponsibleUserId', field: 'main_responsible_user_id' },
        as: 'responsible',
      });
      Contact.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', field: 'created_by' },
        as: 'creator',
      });
      Contact.belongsTo(models.User, {
        foreignKey: { name: 'updatedBy', field: 'updated_by' },
        as: 'updater',
      });

      // contact_points (полиморфно через scope)
      Contact.hasMany(models.ContactPoint, {
        as: 'contactPoints',
        foreignKey: { name: 'ownerId', field: 'owner_id' },
        constraints: false,
        scope: { ownerType: 'contact' },
      });
    }

    get fullName() {
      const a = [this.firstName, this.middleName, this.lastName].filter(Boolean);
      return a.length ? a.join(' ') : this.displayName || null;
    }
  }

  Contact.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },

      companyId:       { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
      counterpartyId:  { type: DataTypes.UUID, allowNull: false, field: 'counterparty_id' },

      mainResponsibleUserId: { type: DataTypes.UUID, allowNull: true, field: 'main_responsible_user_id' },

      firstName:  { type: DataTypes.STRING(100), allowNull: true, field: 'first_name' },
      lastName:   { type: DataTypes.STRING(100), allowNull: true, field: 'last_name' },
      middleName: { type: DataTypes.STRING(100), allowNull: true, field: 'middle_name' },
      displayName:{ type: DataTypes.STRING(200), allowNull: true, field: 'display_name' },

      jobTitle:   { type: DataTypes.STRING(120), allowNull: true, field: 'job_title' },
      department: { type: DataTypes.STRING(120), allowNull: true },

      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_primary' },

      notes: { type: DataTypes.TEXT, allowNull: true },

      createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
      updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },

      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
    },
    {
      sequelize,
      modelName: 'Contact',
      tableName: 'contacts',
      underscored: true,
      paranoid: true,
      timestamps: true,
      validate: {
        atLeastSomeName() {
          if (!this.firstName && !this.lastName && !this.displayName) {
            throw new Error('At least one of firstName/lastName/displayName is required');
          }
        },
      },
    }
  );

  return Contact;
};