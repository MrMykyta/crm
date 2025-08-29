'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('adjustment_items', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      adjustmentId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'adjustment_id',
        references:{ 
          model:'adjustments', 
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
      locationId:{ 
        type:Sequelize.UUID, 
        allowNull:false,
        field:'location_id' 
      },
      lotId:{ 
        type:Sequelize.UUID, 
        field:'lot_id' 
      },
      serialId:{ 
        type:Sequelize.UUID, 
        field:'serial_id' 
      },
      qtyDelta:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false, 
        field:'qty_delta' 
      },
      createdAt:{ 
        type:Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue: Sequelize.NOW 
      },
      updatedAt:{
        type:Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue: Sequelize.NOW
      }
    });
    await queryInterface.addIndex('adjustment_items', ['adjustment_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('adjustment_items');
  }
};