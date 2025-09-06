'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.hasMany(models.Company, {
        foreignKey: 'owner_user_id',
        as: 'owned_companies'
      });
      
      User.hasMany(models.UserCompany, { 
        foreignKey:'user_id', 
        as:'memberships' 
      });

      User.belongsToMany(models.Company, {
        through: models.UserCompany,
        foreignKey: 'user_id',
        otherKey: 'company_id',
        as: 'companies'
      });

      User.hasMany(models.ContactPoint, {
        foreignKey: 'owner_id',
        scope: {
          owner_type: 'user'
        },
        as: 'contacts'
      })
    }
  }
  User.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password_hash'
    },

    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'first_name'
    },

    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'last_name'
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },

    lastLoginAt: {
      type: DataTypes.DATE,
      field: 'last_login_at',
      allowNull: true
    },

    verificationToken: {
      type: DataTypes.STRING(128),
      field:'verification_token',
      allowNull: true
    },
    verificationExpiresAt: {
      type: DataTypes.DATE,
      field:'verification_expires_at',
      allowNull: true
    },
    emailVerifiedAt: {
      type: DataTypes.DATE,
      field: 'email_verified_at',
      allowNull: true
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    paranoid: true,
    underscored: true,
    timestamps: true
  });
  return User;
};