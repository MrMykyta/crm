'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Role.belongsTo(models.Company, { 
        foreignKey: 'companyId', 
        as: 'company' 
      });

      Role.belongsToMany(models.Permission, {
        through: models.RolePermission,
        foreignKey: 'roleId',
        otherKey: 'permissionId',
        as: 'permissions'
      });

      Role.belongsToMany(models.User, {
        through: models.UserRole,
        foreignKey: 'roleId',
        otherKey: 'userId',
        as: 'users'
      });
    }
  }
  Role.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id'
    },
    name: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(256),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Role',
    tableName: 'roles',
    underscored: true,
    timestamps: true
  });
  return Role;
};