'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('count_items', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      countId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'count_id', 
        references:{ 
          model:'cycle_counts', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      locationId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'location_id' 
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
      qtyCounted:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false, 
        field:'qty_counted' 
      },
      createdAt: {
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at',
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      }
    });
    await queryInterface.addIndex('count_items', ['count_id']);
    await queryInterface.addIndex('count_items', ['location_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('count_items');
  }
};