'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('serials', {
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
      productId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'product_id',
        references:{ 
          model:'products', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'RESTRICT' 
      },
      serialNumber:{ 
        type:Sequelize.STRING(128), 
        allowNull:false, 
        field:'serial_number' 
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
    await queryInterface.addIndex('serials', ['product_id']);
    await queryInterface.addConstraint('serials', { 
      fields:['company_id','product_id','serial_number'], 
      type:'unique', 
      name:'uniq_serial_per_product' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('serials');
  }
};