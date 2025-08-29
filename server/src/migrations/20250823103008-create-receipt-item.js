'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('receipt_items', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      receiptId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'receipt_id',
        references:{ 
          model:'receipts', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      productId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'product_id' 
      },
      variantId:{ 
        type:Sequelize.UUID, 
        field:'variant_id' 
      },
      lotNumber:{ 
        type:Sequelize.STRING(64), 
        field:'lot_number' 
      },
      serialNumber:{ 
        type:Sequelize.STRING(128), 
        field:'serial_number' 
      },
      qtyExpected:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false, 
        defaultValue:0, 
        field:'qty_expected' 
      },
      qtyReceived:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false, 
        defaultValue:0, 
        field:'qty_received' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue:Sequelize.NOW 
      },
      updatedAt: {
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue:Sequelize.NOW
      }
    });
    await queryInterface.addIndex('receipt_items', ['receipt_id']);
    await queryInterface.addIndex('receipt_items', ['product_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('receipt_items');
  }
};