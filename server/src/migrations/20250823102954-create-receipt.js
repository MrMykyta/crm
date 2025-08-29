'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('receipts', {
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
      number:{ 
        type:Sequelize.STRING(64), 
        allowNull:false 
      },
      status:{ 
        type:Sequelize.ENUM('draft','received','putaway'), 
        allowNull:false, 
        defaultValue:'draft' 
      },
      inboundLocationId:{ 
        type:Sequelize.UUID, 
        field:'inbound_location_id', 
        references:{ 
          model:'locations',
          key:'id' 
        } 
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

    await queryInterface.addConstraint('receipts', { 
      fields:['company_id','number'], 
      type:'unique', 
      name:'uniq_receipt_company_number' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('receipts');
  }
};