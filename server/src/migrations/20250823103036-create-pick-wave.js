'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pick_waves', {
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
      status:{ 
        type:Sequelize.ENUM('planned','picking','completed','cancelled'), 
        allowNull:false, 
        defaultValue:'planned' 
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
    await queryInterface.addIndex('pick_waves', ['warehouse_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pick_waves');
  }
};