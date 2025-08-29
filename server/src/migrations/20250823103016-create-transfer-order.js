'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transfer_orders', {
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
      number:{ 
        type:Sequelize.STRING(64), 
        allowNull:false 
      },
      fromWarehouseId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'from_warehouse_id', 
        references:{ 
          model:'warehouses', 
          key:'id' 
        } 
      },
      toWarehouseId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'to_warehouse_id', 
        references:{ 
          model:'warehouses', 
          key:'id' 
        } 
      },
      status:{ 
        type:Sequelize.ENUM('draft','in_transit','received'), 
        allowNull:false, 
        defaultValue:'draft' 
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
      },
    });
    await queryInterface.addConstraint('transfer_orders', { 
      fields:['company_id','number'], 
      type:'unique', 
      name:'uniq_transfer_company_number' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transfer_orders');
  }
};