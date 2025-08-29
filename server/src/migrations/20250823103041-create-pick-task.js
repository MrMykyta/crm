'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pick_tasks', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      waveId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'wave_id', 
        references:{ 
          model:'pick_waves', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      orderId:{ 
        type:Sequelize.UUID, 
        field:'order_id' 
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
      fromLocationId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'from_location_id', 
        references:{ 
          model:'locations', 
          key:'id' 
        } 
      },
      toLocationId:{ 
        type:Sequelize.UUID, 
        field:'to_location_id' 
      },
      qty:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false 
      },
      status:{ 
        type:Sequelize.ENUM('new','done','cancelled'), 
        allowNull:false, 
        defaultValue:'new' 
      },
      createdAt:{
        type:Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue:Sequelize.fn('NOW')
      },
      updatedAt:{
        type:Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue:Sequelize.fn('NOW')
      }
    });
    await queryInterface.addIndex('pick_tasks', ['wave_id']);
    await queryInterface.addIndex('pick_tasks', ['order_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pick_tasks');
  }
};