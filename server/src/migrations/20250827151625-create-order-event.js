'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_events', {
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
        onDelete: 'CASCADE'
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
      actorId: {
        type: Sequelize.UUID,
        allowNull: true,  // null for system events
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'actor_id'
      },
      type: {
        type: Sequelize.ENUM('status_change','payment','shipment','refund','note_added','other'), 
        allowNull: false 
      },
      message: { 
        type: Sequelize.TEXT 
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
    await queryInterface.addIndex('order_events', ['order_id','created_at'], { 
      name: 'order_events_order_created_idx' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('order_events');
  }
};