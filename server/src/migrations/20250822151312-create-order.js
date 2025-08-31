'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
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
      offerId: {
        type: Sequelize.UUID,
        references: { 
          model: 'offers', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'offer_id'
      },
      customerId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'counterparties', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'RESTRICT',
        field: 'customer_id'
      },
      salesChannelId: {
        type: Sequelize.UUID,
        references: { 
          model: 'channels', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field:'sales_channel_id'
      },
      shippingClassId: {
        type: Sequelize.UUID,
        references: { 
          model: 'shipping_classes', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'shipping_class_id'
      },
      currencyCode: { 
        type: Sequelize.STRING(3), 
        allowNull: false,
        field: 'currency_code'
      },
      status: { 
        type: Sequelize.ENUM('draft','new','confirmed','paid','shipped','completed','cancelled','returned'), 
        allowNull: false, 
        defaultValue: 'draft' 
      },
      paymentStatus: { 
        type: Sequelize.ENUM('pending','paid','refunded','partially_refunded'), 
        allowNull: false, 
        defaultValue: 'pending',
        field: 'payment_status'
      },
      fulfillmentStatus: { 
        type: Sequelize.ENUM('unfulfilled','partial','fulfilled'), 
        allowNull: false, 
        defaultValue: 'unfulfilled',
        field: 'fulfillment_status'
      },
      placedAt: { 
        type: Sequelize.DATE,
        field: 'placed_at'
      }, 
      confirmedAt: { 
        type: Sequelize.DATE,
        field: 'confirmed_at'
      }, 
      shippedAt: { 
        type: Sequelize.DATE,
        field: 'shipped_at'
      }, 
      completedAt: {
        type: Sequelize.DATE,
        field: 'completed_at'
      }, 
      cancelledAt: { 
        type: Sequelize.DATE,
        field: 'cancelled_at'
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
        type: Sequelize.DATE,
        allowNull: true,
        field: 'deleted_at'
      }
    });
    await queryInterface.addIndex('orders', ['company_id','created_at'], { 
      name: 'orders_company_created_idx' 
    });
    await queryInterface.addIndex('orders', ['company_id','customer_id'], { 
      name: 'orders_company_customer_idx' 
    });
    await queryInterface.addIndex('orders', ['status'], { 
      name: 'orders_status_idx' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('orders');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_fulfillment_status";');
  }
};