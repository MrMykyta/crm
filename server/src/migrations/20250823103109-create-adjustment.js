'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('adjustments', {
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
        } 
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
      reason:{ 
        type:Sequelize.STRING(160) 
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
        field:'updated_at' 
      }
    });
    await queryInterface.addIndex('adjustments', ['warehouse_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('adjustments');
  }
};