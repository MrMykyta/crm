'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserRole extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  UserRole.init({
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id'
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'role_id'
    }
  }, {
    sequelize,
    modelName: 'UserRole',
    tableName: 'user_roles',
    underscored: true,
    timestamps: false
  });
  return UserRole;
};