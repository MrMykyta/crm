'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class Deal extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Deal.belongsTo(models.Company, { 
        foreignKey: 'companyId', 
        as: 'company' 
      });
      Deal.belongsTo(models.Counterparty, { 
        foreignKey: 'counterpartyId', 
        as: 'counterparty' 
      });
      Deal.belongsTo(models.User, { 
        foreignKey: 'responsibleId', 
        as: 'responsible' 
      });
      Deal.belongsTo(models.CrmPipeline, {
        foreignKey: { name: 'pipelineId', field: 'pipeline_id' },
        as: 'pipeline',
      });
      Deal.belongsTo(models.CrmPipelineStage, {
        foreignKey: { name: 'stageId', field: 'stage_id' },
        as: 'stage',
      });
      Deal.belongsTo(models.Contact, {
        foreignKey: { name: 'contactId', field: 'contact_id' },
        as: 'contact',
      });
      Deal.belongsTo(models.CrmDealLostReason, {
        foreignKey: { name: 'lostReasonId', field: 'lost_reason_id' },
        as: 'lostReason',
      });
      Deal.belongsTo(models.Task, {
        foreignKey: { name: 'nextActionTaskId', field: 'next_action_task_id' },
        as: 'nextActionTask',
      });


      Deal.hasMany(models.Task, {
        foreignKey: { name: 'dealId', field: 'deal_id' },
        as: 'tasks',
      });

      Deal.hasMany(models.CrmDealActivity, {
        foreignKey: { name: 'dealId', field: 'deal_id' },
        as: 'activities',
      });
    }
  }
  Deal.init({
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
    counterpartyId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'counterparty_id' 
    },
    title: { 
      type: DataTypes.STRING(256), 
      allowNull: false 
    },
    description: { 
      type: DataTypes.TEXT 
    },
    status: {
      type: DataTypes.ENUM('new', 'in_progress', 'won', 'lost'),
      allowNull: false,
      defaultValue: 'new'
    },
    value: { 
      type: DataTypes.DECIMAL(14,2) 
    },
    currency: { 
      type: DataTypes.STRING(8), 
      defaultValue: 'PLN' 
    },
    responsibleId: { 
      type: DataTypes.UUID, 
      field: 'responsible_id' 
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'updated_by'
    },
    pipelineId: { 
      type: DataTypes.UUID,
      allowNull:true, 
      field: 'pipeline_id' 
    },
    stageId: {
      type: DataTypes.UUID, 
      allowNull:true,
      field:'stage_id'
    },
    stageEnteredAt: {
      type: DataTypes.DATE,
      allowNull:true,
      field:'stage_entered_at'
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'contact_id'
    },
    expectedCloseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'expected_close_date'
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'closed_at'
    },
    lostReasonId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'lost_reason_id'
    },
    lostNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'lost_note'
    },
    priority: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      validate: { min: 0, max: 100 }
    },
    source: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    probability: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      validate: { min: 0, max: 100 }
    },
    nextActionAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'next_action_at'
    },
    nextActionType: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'next_action_type'
    },
    nextActionTaskId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'next_action_task_id'
    },
    healthStatus: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'health_status'
    },
    healthComputedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'health_computed_at'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at'
    }
  }, {
    sequelize,
    modelName: 'Deal',
    tableName: 'deals',
    underscored: true,
    timestamps: true,
    paranoid: true
  });
  return Deal;
};
