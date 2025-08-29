'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CompanyDepartment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      CompanyDepartment.belongsTo(models.Company, { 
        foreignKey: 'company_id', 
        as: 'company' 
      });
      CompanyDepartment.hasMany(models.UserCompany, {
        foreignKey: 'departmentId',
        as: 'members'
      });
    }
  }
  CompanyDepartment.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'company_id' 
    },
    name: { 
      type: DataTypes.STRING(100), 
      allowNull: false 
    },
    description: { 
      type: DataTypes.TEXT 
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
    modelName: 'CompanyDepartment',
    tableName: 'company_departments',
    paranoid: true, 
    underscored: true, 
    timestamps: true
  });
  return CompanyDepartment;
};