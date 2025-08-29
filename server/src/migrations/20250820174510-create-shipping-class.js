'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shipping_classes', {
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
        onDelete:'CASCADE', 
        onUpdate:'CASCADE' 
      },
      code:{ 
        type:Sequelize.STRING(32), 
        allowNull:false 
      },
      name:{ 
        type:Sequelize.STRING(160), 
        allowNull:false 
      },
      isActive:{ 
        type:Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:true, 
        field:'is_active' 
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
    await queryInterface.addIndex('shipping_classes', ['company_id']);
    await queryInterface.addConstraint('shipping_classes', { 
      fields:['company_id','code'], 
      type:'unique', 
      name:'uniq_ship_company_code' 
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('shipping_classes');
  }
};