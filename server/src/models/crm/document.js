'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Document extends Model {
    static associate(models) {
      Document.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
      Document.belongsTo(models.Counterparty, {
        as: 'client',
        foreignKey: { name: 'clientId', field: 'client_id' },
      });
      Document.belongsTo(models.Contact, {
        as: 'contact',
        foreignKey: { name: 'contactId', field: 'contact_id' },
      });
      Document.belongsTo(models.Deal, {
        as: 'relatedDeal',
        foreignKey: { name: 'relatedDealId', field: 'related_deal_id' },
      });
      Document.belongsTo(models.Warehouse, {
        as: 'warehouse',
        foreignKey: { name: 'warehouseId', field: 'warehouse_id' },
      });
      Document.belongsTo(models.User, {
        as: 'owner',
        foreignKey: { name: 'ownerId', field: 'owner_id' },
      });
      Document.belongsTo(models.User, {
        as: 'creator',
        foreignKey: { name: 'createdBy', field: 'created_by' },
      });
      Document.belongsTo(models.User, {
        as: 'updater',
        foreignKey: { name: 'updatedBy', field: 'updated_by' },
      });
      Document.belongsTo(models.User, {
        as: 'generator',
        foreignKey: { name: 'generatedBy', field: 'generated_by' },
      });
      Document.belongsTo(models.File, {
        as: 'generatedFile',
        foreignKey: { name: 'fileId', field: 'file_id' },
      });

      Document.hasMany(models.DocumentItem, {
        as: 'items',
        foreignKey: { name: 'documentId', field: 'document_id' },
        onDelete: 'CASCADE',
      });
    }
  }

  Document.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
      type: { type: DataTypes.STRING(32), allowNull: false },
      direction: { type: DataTypes.STRING(16), allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
      number: { type: DataTypes.STRING(128), allowNull: true },
      clientId: { type: DataTypes.UUID, allowNull: true, field: 'client_id' },
      contactId: { type: DataTypes.UUID, allowNull: true, field: 'contact_id' },
      issueDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'issue_date' },
      validFrom: { type: DataTypes.DATEONLY, allowNull: true, field: 'valid_from' },
      validTo: { type: DataTypes.DATEONLY, allowNull: true, field: 'valid_to' },
      validDays: { type: DataTypes.INTEGER, allowNull: true, field: 'valid_days' },
      paymentDueDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'payment_due_date' },
      paymentDays: { type: DataTypes.INTEGER, allowNull: true, field: 'payment_days' },
      paymentStatus: { type: DataTypes.STRING(32), allowNull: true, field: 'payment_status' },
      paidAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'paid_amount' },
      remainingAmount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'remaining_amount',
      },
      paymentDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'payment_date' },
      paymentMethod: { type: DataTypes.STRING(64), allowNull: true, field: 'payment_method' },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'PLN' },
      language: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'pl' },
      template: { type: DataTypes.STRING(64), allowNull: true },
      fileId: { type: DataTypes.UUID, allowNull: true, field: 'file_id' },
      generatedAt: { type: DataTypes.DATE, allowNull: true, field: 'generated_at' },
      generatedBy: { type: DataTypes.UUID, allowNull: true, field: 'generated_by' },
      templateVersionId: { type: DataTypes.UUID, allowNull: true, field: 'template_version_id' },
      notes: { type: DataTypes.TEXT, allowNull: true },
      internalNotes: { type: DataTypes.TEXT, allowNull: true, field: 'internal_notes' },
      sourceEntityType: { type: DataTypes.STRING(64), allowNull: true, field: 'source_entity_type' },
      sourceEntityId: { type: DataTypes.UUID, allowNull: true, field: 'source_entity_id' },
      sourceDocumentId: { type: DataTypes.UUID, allowNull: true, field: 'source_document_id' },
      sourceDocumentType: { type: DataTypes.STRING(32), allowNull: true, field: 'source_document_type' },
      relatedDealId: { type: DataTypes.UUID, allowNull: true, field: 'related_deal_id' },
      warehouseId: { type: DataTypes.UUID, allowNull: true, field: 'warehouse_id' },
      ownerId: { type: DataTypes.UUID, allowNull: true, field: 'owner_id' },
      totalNet: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'total_net' },
      totalVat: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'total_vat' },
      totalGross: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'total_gross' },
      totalDiscount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'total_discount',
      },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
      updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      sequelize,
      modelName: 'Document',
      tableName: 'documents',
      underscored: true,
      timestamps: true,
    }
  );

  return Document;
};
