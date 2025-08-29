'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shipments', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      companyId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'company_id',
        references:{ 
          model:'companies', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      warehouseId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'warehouse_id', 
        references:{ 
          model:'warehouses', 
          key:'id' 
        } 
      },
      orderId:{ 
        type:Sequelize.UUID, 
        field:'order_id', 
        references:{ 
          model:'orders', 
          key:'id' 
        } 
      },
      status:{ 
        type:Sequelize.ENUM('packing','shipped','cancelled'), 
        allowNull:false, 
        defaultValue:'packing' 
      },
      createdAt:{ 
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.NOW, 
        field:'created_at' 
      },
      updatedAt:{
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.NOW, 
        field:'updated_at'
      }
    });
    await queryInterface.addIndex('shipments', ['warehouse_id']);
    await queryInterface.addIndex('shipments', ['order_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('shipments');
  }
};