'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('uoms', {
      id: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        primaryKey: true, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: {
        type: Sequelize.UUID, 
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
        type: Sequelize.STRING(32), 
        allowNull:false, 
        unique: true 
      },
      name: { 
        type: Sequelize.STRING(128), 
        allowNull:false 
      },
      precision: { 
        type: Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue: 2 
      },
      isActive: { 
        type: Sequelize.BOOLEAN, 
        allowNull:false,
        defaultValue:true, 
        field:'is_active' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'created_at' 
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at' 
      }
    });
    await queryInterface.addIndex('uoms', ['company_id']);
    await queryInterface.addConstraint('uoms', { 
      fields:['company_id','code'], 
      type:'unique', 
      name:'uniq_uom_company_code' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('uoms');
  }
};