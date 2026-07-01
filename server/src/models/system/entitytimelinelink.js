'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EntityTimelineLink extends Model {
    static associate(models) {
      EntityTimelineLink.belongsTo(models.Company, {
        foreignKey: 'companyId',
        as: 'company',
      });
      EntityTimelineLink.belongsTo(models.EntityTimelineEvent, {
        foreignKey: 'timelineEventId',
        as: 'event',
        onDelete: 'CASCADE',
      });
    }
  }

  EntityTimelineLink.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id',
    },
    timelineEventId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'timeline_event_id',
    },
    entityType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'entity_type',
    },
    entityId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'entity_id',
    },
    role: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'related',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
  }, {
    sequelize,
    modelName: 'EntityTimelineLink',
    tableName: 'entity_timeline_links',
    underscored: true,
    timestamps: false,
  });

  return EntityTimelineLink;
};
