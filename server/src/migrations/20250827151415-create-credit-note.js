'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('credit_notes', {
      id: { 
        type: Sequelize.UUID, 
        primaryKey: true, 
        allowNull: false, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'company_id'
      },
      invoiceId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'invoices', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'invoice_id'
      },
      amountNet: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false,
        field: 'amount_net' 
      },
      amountTax: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false,
        field: 'amount_tax'
      },
      amountGross: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false,
        field: 'amount_gross'
      },
      reason: { 
        type: Sequelize.STRING(256) 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at',
        defaultValue: Sequelize.fn('NOW') 
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false,
        field: 'updated_at',
        defaultValue: Sequelize.fn('NOW') 
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'deleted_at'
      }
    });
    await queryInterface.addIndex('credit_notes', ['invoice_id'], { 
      name: 'credit_notes_invoice_idx' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('credit_notes');
  }
};