"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.Company, {
        foreignKey: "companyId",
        as: "company",
      });
      Notification.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
    }
  }

  Notification.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      companyId: {
        field: "company_id",
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        field: "user_id",
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      entityType: {
        field: "entity_type",
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      entityId: {
        field: "entity_id",
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      meta: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      isRead: {
        field: "is_read",
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "Notification",     // 👈 НОРМАЛЬНОЕ имя
      tableName: "notifications",
      underscored: true,
      timestamps: true,
    }
  );

  return Notification;
};