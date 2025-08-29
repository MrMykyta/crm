'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attributes', {
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
          key:'id' }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE'
      },
      code: { 
        type: Sequelize.STRING(64), 
        allowNull:false 
      },
      name: { 
        type: Sequelize.STRING(160), 
        allowNull:false 
      },
      type: { 
        type: Sequelize.ENUM('text','number','boolean','date','select','multiselect'), 
        allowNull:false 
      },
      isRequired: { 
        type: Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:false, 
        field:'is_required' 
      },
      isVariant: { 
        type: Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:false, 
        field:'is_variant' 
      }, // участвует в вариантах
      unit: { 
        type: Sequelize.STRING(32) 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue: Sequelize.NOW
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('attributes', ['company_id']);
    await queryInterface.addIndex('attributes', ['type']);
    await queryInterface.addConstraint('attributes', { 
      fields:['company_id','code'], 
      type:'unique', 
      name:'uniq_attribute_company_code' 
    });
    await queryInterface.addIndex('attributes', ['is_variant']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('attributes');
  }
};