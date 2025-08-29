'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RolePermission extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  RolePermission.init({
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'role_id'
    },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'permission_id'
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
    modelName: 'RolePermission',
    tableName: 'role_permissions',
    underscored: true,
    timestamps: false
  });
  return RolePermission;
};