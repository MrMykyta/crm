'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserPermission extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      UserPermission.belongsTo(models.User, { 
        as: 'user',       
        foreignKey: 'userId' 
      });
      UserPermission.belongsTo(models.Permission, { 
        as: 'permission', 
        foreignKey: 'permissionId' 
      }); // 👈 ВАЖНО
    }
  }
  UserPermission.init({
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'permission_id'
    }
  }, {
    sequelize,
    modelName: 'UserPermission',
    tableName: 'user_permissions',
    underscored: true,
    timestamps: false
  });
  return UserPermission;
};