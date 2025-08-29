'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Company extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Company.belongsTo(models.User, {
        foreignKey: 'owner_user_id',
        as: 'owner'
      });
      Company.hasMany(models.UserCompany, { 
        foreignKey:'company_id', 
        as:'memberships' 
      });

      Company.belongsToMany(models.User, {
        through: models.UserCompany,
        foreignKey: 'company_id',
        otherKey: 'user_id',
        as: 'users'
      });

      Company.hasMany(models.ContactPoint, { 
        foreignKey: 'owner_id',
        scope: {
          owner_type: 'company'
        },
        as: 'contacts'
      });
    }
  }
  Company.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    nip: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    regon: {
      type: DataTypes.STRING(14),
      allowNull: true
    },
    krs: {
      type: DataTypes.STRING(14),
      allowNull: true
    },
    bdo: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    website: {
      type: DataTypes.STRING(2048),
      allowNull: true
    },
    street: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    postalCode: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'postal_code'
    },
    city: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ownerUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      field: 'owner_user_id'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
    }

  }, {
    sequelize,
    modelName: 'Company',
    tableName: 'companies',
    paranoid: true,
    underscored: true,
    timestamps: true
  });
  return Company;
};