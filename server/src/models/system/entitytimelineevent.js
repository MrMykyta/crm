'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EntityTimelineEvent extends Model {
    static associate(models) {
      EntityTimelineEvent.belongsTo(models.Company, {
        foreignKey: 'companyId',
        as: 'company',
      });
      EntityTimelineEvent.belongsTo(models.User, {
        foreignKey: 'actorUserId',
        as: 'actor',
      });
      EntityTimelineEvent.hasMany(models.EntityTimelineLink, {
        foreignKey: 'timelineEventId',
        as: 'links',
      });
    }
  }

  EntityTimelineEvent.init({
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
    eventType: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'event_type',
    },
    eventCategory: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'system',
      field: 'event_category',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actorUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'actor_user_id',
    },
    actorNameSnapshot: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'actor_name_snapshot',
    },
    sourceModule: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'source_module',
    },
    sourceEntityType: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'source_entity_type',
    },
    sourceEntityId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'source_entity_id',
    },
    relatedEntityType: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'related_entity_type',
    },
    relatedEntityId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'related_entity_id',
    },
    parentEventId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'parent_event_id',
    },
    correlationId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'correlation_id',
    },
    requestId: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'request_id',
    },
    changes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    visibility: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'company',
    },
    severity: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'info',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
  }, {
    sequelize,
    modelName: 'EntityTimelineEvent',
    tableName: 'entity_timeline_events',
    underscored: true,
    timestamps: false,
  });

  return EntityTimelineEvent;
};
