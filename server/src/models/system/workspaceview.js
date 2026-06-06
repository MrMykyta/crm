'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WorkspaceView extends Model {
    static associate(models) {
      WorkspaceView.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
      WorkspaceView.belongsTo(models.User, {
        as: 'owner',
        foreignKey: { name: 'ownerUserId', field: 'owner_user_id' },
      });
      WorkspaceView.hasMany(models.WorkspaceViewUserPref, {
        as: 'userPrefs',
        foreignKey: { name: 'viewId', field: 'view_id' },
      });
    }
  }

  WorkspaceView.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      module: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      key: {
        // Set for system views; NULL for personal. CHECK constraint at DB level enforces.
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      scope: {
        type: DataTypes.ENUM('system', 'personal'),
        allowNull: false,
        defaultValue: 'personal',
      },
      ownerUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'owner_user_id',
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      nameI18nKey: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'name_i18n_key',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      icon: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      filter: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      sort: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      columns: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      viewType: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'list',
        field: 'view_type',
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default',
      },
      isLocked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_locked',
      },
    },
    {
      sequelize,
      modelName: 'WorkspaceView',
      tableName: 'workspace_views',
      underscored: true,
      timestamps: true,
    }
  );

  return WorkspaceView;
};
