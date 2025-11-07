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
      UserPermission.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });
      UserPermission.belongsTo(models.Permission, { 
        as: 'permission', 
        foreignKey: 'permissionId' 
      });
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
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id'
    },
    effect: {
      type: DataTypes.ENUM('allow', 'deny'),
      defaultValue: 'allow',
      allowNull: false
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