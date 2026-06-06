'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WorkspaceViewUserPref extends Model {
    static associate(models) {
      WorkspaceViewUserPref.belongsTo(models.WorkspaceView, {
        as: 'view',
        foreignKey: { name: 'viewId', field: 'view_id' },
      });
      WorkspaceViewUserPref.belongsTo(models.User, {
        as: 'user',
        foreignKey: { name: 'userId', field: 'user_id' },
      });
    }
  }

  WorkspaceViewUserPref.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      viewId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'view_id',
      },
      pinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      hidden: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'sort_order',
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at',
      },
    },
    {
      sequelize,
      modelName: 'WorkspaceViewUserPref',
      tableName: 'workspace_view_user_prefs',
      underscored: true,
      timestamps: true,
    }
  );

  return WorkspaceViewUserPref;
};
