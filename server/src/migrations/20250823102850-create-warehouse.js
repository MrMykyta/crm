'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('warehouses', {
      id: { 
        type:Sequelize.UUID, 
        allowNull:false, 
        primaryKey:true, 
        defaultValue:Sequelize.UUIDV4 
      },
      companyId: { 
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
      code: { 
        type:Sequelize.STRING(32), 
        allowNull:false 
      },
      name: { 
        type:Sequelize.STRING(160), 
        allowNull:false 
      },
      isActive: { 
        type:Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:true, 
        field:'is_active' 
      },
      createdAt: { 
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.NOW, 
        field:'created_at' 
      },
      updatedAt: { 
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.NOW, 
        field:'updated_at' 
      },
    });
    await queryInterface.addIndex('warehouses', ['company_id']);
    await queryInterface.addConstraint('warehouses', { 
      fields:['company_id','code'], 
      type:'unique', 
      name:'uniq_wh_company_code' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('warehouses');
  }
};