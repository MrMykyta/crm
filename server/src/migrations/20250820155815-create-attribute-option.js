'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attribute_options', {
      id: { 
        type: Sequelize.UUID, 
        allowNull:false, 
        primaryKey:true, 
        defaultValue:Sequelize.UUIDV4 
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
      attributeId: {
        type: Sequelize.UUID, 
        allowNull:false, 
        field:'attribute_id',
        references:{ 
          model:'attributes', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE'
      },
      value: { 
        type: Sequelize.STRING(160), 
        allowNull:false 
      },
      sortOrder: { 
        type: Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue:0, 
        field:'sort_order' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue: Sequelize.fn('NOW')
      }
    });
    await queryInterface.addIndex('attribute_options', ['company_id']);
    await queryInterface.addIndex('attribute_options', ['attribute_id']);
    await queryInterface.addConstraint('attribute_options', {
      fields:['company_id','attribute_id','value'],
      type:'unique', 
      name:'uniq_attr_option_company_attr_value'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('attribute_options');
  }
};