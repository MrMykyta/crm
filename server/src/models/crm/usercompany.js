'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserCompany extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      UserCompany.belongsTo(models.User, { 
        foreignKey:'userId', 
        as:'user' 
      });
      UserCompany.belongsTo(models.Company, { 
        foreignKey:'companyId', 
        as:'company' 
      });
      UserCompany.belongsTo(models.CompanyDepartment, {
        foreignKey: 'departmentId',
        as: 'department'
      });
    }
  }
  UserCompany.init({
    id: {
      allowNull: false,
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
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
    role: {
      type: DataTypes.ENUM('owner','admin','manager','viewer'),
      allowNull: false,
      defaultValue: 'viewer'
    },
    status: {
      type: DataTypes.ENUM('active', 'invited', 'suspended'),
      allowNull: false,
      defaultValue: 'active'
    },
    departmentId: { 
      type: DataTypes.UUID, 
      allowNull: true,  
      field: 'department_id' 
    },
    isLead: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: false, 
      field: 'is_lead' 
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'joined_at'
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
    modelName: 'UserCompany',
    tableName: 'user_companies',
    paranoid: true,
    underscored: true,
    timestamps: true
  });
  return UserCompany;
};