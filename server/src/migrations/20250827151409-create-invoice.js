'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoices', {
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
      orderId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'orders', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'order_id'
      },
      number: { 
        type: Sequelize.STRING(64), 
        allowNull: false 
      },
      issueDate: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'issue_date'
      },
      dueDate: { 
        type: Sequelize.DATE,
        field: 'due_date'
      },
      paidDate: { 
        type: Sequelize.DATE,
        field: 'paid_date'
      },
      totalNet: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'total_net'
      },
      totalTax: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'total_tax'
      },
      totalGross: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'total_gross'
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at'
      },
      deletedAt: { 
        type: Sequelize.DATE ,
        allowNull: true,
        field: 'deleted_at'
      }
    });
    await queryInterface.addIndex('invoices', ['order_id'], { 
      name: 'invoices_order_idx' 
    });
    await queryInterface.addConstraint('invoices', {
      fields: ['company_id','number'],
      type: 'unique',
      name: 'invoices_company_number_unique'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('invoices','invoices_company_number_unique');
    await queryInterface.dropTable('invoices');
  }
};