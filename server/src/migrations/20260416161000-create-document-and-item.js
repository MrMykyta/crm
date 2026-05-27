'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documents', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING(32), allowNull: false },
      direction: { type: Sequelize.STRING(16), allowNull: false },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'draft' },
      number: { type: Sequelize.STRING(128), allowNull: true },
      clientId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'client_id',
        references: { model: 'counterparties', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      contactId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'contact_id',
        references: { model: 'contacts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      issueDate: { type: Sequelize.DATEONLY, allowNull: false, field: 'issue_date' },
      validFrom: { type: Sequelize.DATEONLY, allowNull: true, field: 'valid_from' },
      validTo: { type: Sequelize.DATEONLY, allowNull: true, field: 'valid_to' },
      validDays: { type: Sequelize.INTEGER, allowNull: true, field: 'valid_days' },
      paymentDueDate: { type: Sequelize.DATEONLY, allowNull: true, field: 'payment_due_date' },
      paymentDays: { type: Sequelize.INTEGER, allowNull: true, field: 'payment_days' },
      paymentStatus: { type: Sequelize.STRING(32), allowNull: true, field: 'payment_status' },
      paidAmount: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'paid_amount' },
      remainingAmount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'remaining_amount',
      },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'PLN' },
      language: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'pl' },
      template: { type: Sequelize.STRING(64), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      internalNotes: { type: Sequelize.TEXT, allowNull: true, field: 'internal_notes' },
      sourceDocumentId: { type: Sequelize.UUID, allowNull: true, field: 'source_document_id' },
      sourceDocumentType: { type: Sequelize.STRING(32), allowNull: true, field: 'source_document_type' },
      relatedDealId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'related_deal_id',
        references: { model: 'deals', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      warehouseId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'warehouse_id',
        references: { model: 'warehouses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'owner_id',
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      totalNet: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'total_net' },
      totalVat: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'total_vat' },
      totalGross: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'total_gross' },
      totalDiscount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'total_discount',
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'created_by',
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'updated_by',
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW'), field: 'created_at' },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW'), field: 'updated_at' },
    });

    await queryInterface.addIndex('documents', ['company_id', 'created_at'], {
      name: 'documents_company_created_idx',
    });
    await queryInterface.addIndex('documents', ['company_id', 'type'], {
      name: 'documents_company_type_idx',
    });
    await queryInterface.addIndex('documents', ['client_id'], {
      name: 'documents_client_idx',
    });

    await queryInterface.createTable('document_items', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      documentId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'document_id',
        references: { model: 'documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
      productId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'product_id',
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: { type: Sequelize.STRING(512), allowNull: false },
      sku: { type: Sequelize.STRING(128), allowNull: true },
      ean: { type: Sequelize.STRING(64), allowNull: true },
      pkwiu: { type: Sequelize.STRING(64), allowNull: true },
      cn: { type: Sequelize.STRING(64), allowNull: true },
      gtu: { type: Sequelize.STRING(64), allowNull: true },
      itemType: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'custom', field: 'item_type' },
      quantity: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 1 },
      unit: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'szt' },
      unitNet: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'unit_net' },
      unitGross: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'unit_gross' },
      vatRate: { type: Sequelize.DECIMAL(8, 4), allowNull: false, defaultValue: 0, field: 'vat_rate' },
      discountPercent: {
        type: Sequelize.DECIMAL(8, 4),
        allowNull: false,
        defaultValue: 0,
        field: 'discount_percent',
      },
      discountValue: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'discount_value',
      },
      sumNet: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'sum_net' },
      sumVat: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'sum_vat' },
      sumGross: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'sum_gross' },
      warehouseId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'warehouse_id',
        references: { model: 'warehouses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      comment: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW'), field: 'created_at' },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW'), field: 'updated_at' },
    });

    await queryInterface.addIndex('document_items', ['document_id', 'sort_order'], {
      name: 'document_items_document_sort_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('document_items');
    await queryInterface.dropTable('documents');
  },
};

