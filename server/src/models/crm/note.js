'use strict';
const { Model } = require('sequelize');

const NOTE_OWNER_TYPES = [
  'counterparty',
  'deal',
  'task',
  'order',
  'offer',
  'product',
  'contact',
  'user',
  'company',
  'department',
];

// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class Note extends Model {
        // Описывает associations этой модели с другими сущностями.
static associate(models) {
      Note.belongsTo(models.Company, {
        foreignKey: 'companyId',
        as: 'company',
      });
      Note.belongsTo(models.User, {
        foreignKey: 'authorUserId',
        as: 'author',
      });
      Note.belongsTo(models.CompanyDepartment, {
        foreignKey: { name: 'visibilityDepartmentId', field: 'visibility_department_id' },
        as: 'visibilityDepartment',
      });
    }
  }

  Note.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      ownerType: {
        type: DataTypes.ENUM(...NOTE_OWNER_TYPES),
        allowNull: false,
        field: 'owner_type',
      },
      ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'owner_id',
      },
      authorUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'created_by',
      },
      updatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'updated_by',
      },
      responsibleId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'responsible_id',
      },
      visibility: {
        type: DataTypes.ENUM('private', 'company', 'department'),
        allowNull: false,
        defaultValue: 'company',
      },
      visibilityDepartmentId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'visibility_department_id',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      pinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    },
    {
      sequelize,
      modelName: 'Note',
      tableName: 'notes',
      underscored: true,
      paranoid: true,
      timestamps: true,
      validate: {
        visibilityDepartmentRequired() {
          if (this.visibility === 'department' && !this.visibilityDepartmentId) {
            throw new Error('visibilityDepartmentId is required when visibility is department');
          }
        },
      },
    }
  );

  return Note;
};
