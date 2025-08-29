'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
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
      method: { 
        type: Sequelize.ENUM('card','bank_transfer','cash','cod','paypal','stripe','other'), 
        allowNull: false 
      },
      status: { 
        type: Sequelize.ENUM('pending','authorized','paid','failed','refunded'), 
        allowNull: false, 
        defaultValue: 'pending' 
      },
      amount: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false 
      },
      transactionId: { 
        type: Sequelize.STRING(128),
        field:'transaction_id' 
      },
      processedAt: { 
        type: Sequelize.DATE,
        field:'processed_at' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field:'created_at' 
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field:'updated_at'
      },
      deletedAt: { 
        type: Sequelize.DATE,
        allowNull: true,
        field:'deleted_at' 
      }
    });

    await queryInterface.addIndex('payments', ['order_id'], { 
      name: 'payments_order_idx' 
    });
    await queryInterface.addIndex('payments', ['status'], { 
      name: 'payments_status_idx' 
    });
    await queryInterface.addConstraint('payments', {
      fields: ['company_id','transaction_id'],
      type: 'unique',
      name: 'payments_company_transaction_unique'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('payments', 'payments_company_transaction_unique');
    await queryInterface.dropTable('payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_method";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_status";');
  }
};