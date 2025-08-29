'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shipment_items', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      shipmentId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'shipment_id',
        references:{ 
          model:'shipments',
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
      qty:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false 
      },
      createdAt:{
        type:Sequelize.DATE,
        allowNull:false, 
        field:'created_at',
        defaultValue:Sequelize.NOW
      },
      updatedAt:{
        type:Sequelize.DATE,
        allowNull:false, 
        field:'updated_at',
        defaultValue:Sequelize.NOW
      }
    });
    await queryInterface.addIndex('shipment_items', ['shipment_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('shipment_items');
  }
};