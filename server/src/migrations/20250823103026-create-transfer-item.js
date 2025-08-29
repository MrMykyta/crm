'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transfer_items', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      transferId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'transfer_id', 
        references:{ 
          model:'transfer_orders', 
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
      lotId:{ 
        type:Sequelize.UUID, 
        field:'lot_id' 
      },
      serialId:{ 
        type:Sequelize.UUID, 
        field:'serial_id' 
      },
      qty:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false 
      },
      createdAt:{
        type: Sequelize.DATE, 
        field:'created_at', 
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt:{
        type: Sequelize.DATE, 
        field:'updated_at', 
        defaultValue: Sequelize.fn('NOW')
      }
    });
    await queryInterface.addIndex('transfer_items', ['transfer_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transfer_items');
  }
};