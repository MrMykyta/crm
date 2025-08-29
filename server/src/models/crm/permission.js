'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Permission.belongsToMany(models.Role, {
        through: models.RolePermission,
        foreignKey: 'permissionId',
        otherKey: 'roleId',
        as: 'roles'
      });

      Permission.belongsToMany(models.User, {
        through: models.UserPermission,
        foreignKey: 'permissionId',
        otherKey: 'userId',
        as: 'users'
      });
    }
  }
  Permission.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(256),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Permission',
    tableName: 'permissions',
    underscored: true,
    timestamps: true
  });
  return Permission;
};