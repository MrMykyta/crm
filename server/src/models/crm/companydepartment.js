'use strict';
const { Model } = require('sequelize');

// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class CompanyDepartment extends Model {
        // Описывает associations этой модели с другими сущностями.
static associate(models) {
      // Компания
      CompanyDepartment.belongsTo(models.Company, {
        foreignKey: { name: 'companyId', field: 'company_id' },
        as: 'company',
      });

      // Связь с membership-пивотом (UserCompany)
      CompanyDepartment.hasMany(models.UserCompany, {
        foreignKey: { name: 'departmentId', field: 'department_id' },
        as: 'members',
      });

      CompanyDepartment.belongsToMany(models.Task, {
        through: 'task_department_participants',
        foreignKey: { name: 'departmentId', field: 'department_id' },
        otherKey:   { name: 'taskId', field: 'task_id' },
        as: 'tasks',
      });
    }
  }

  CompanyDepartment.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
      name: { type: DataTypes.STRING(100), allowNull: false },
      code: { type: DataTypes.STRING(32), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'CompanyDepartment',
      tableName: 'company_departments',
      underscored: true,
      timestamps: true,
      paranoid: true,
    }
  );

  return CompanyDepartment;
};
