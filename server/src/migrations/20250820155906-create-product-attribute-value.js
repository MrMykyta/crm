'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_attribute_values', {
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
      productId: {
        type: Sequelize.UUID, 
        allowNull:false, 
        field:'product_id',
        references:{ 
          model:'products', 
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
      valueText: { 
        type: Sequelize.TEXT, 
        field:'value_text' 
      },
      valueNumber: { 
        type: Sequelize.DECIMAL(18,6), 
        field:'value_number' 
      },
      valueBoolean: { 
        type: Sequelize.BOOLEAN, 
        field:'value_boolean' 
      },
      valueDate: { 
        type: Sequelize.DATE, 
        field:'value_date' 
      },
      valueJson: { 
        type: Sequelize.JSONB, 
        field:'value_json' 
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

    await queryInterface.addConstraint('product_attribute_values', {
      fields:['product_id','attribute_id'],
      type:'unique', name:'uniq_product_attribute'
    });
    await queryInterface.addIndex('product_attribute_values', ['product_id']);
    await queryInterface.addIndex('product_attribute_values', ['company_id']);
    await queryInterface.addIndex('product_attribute_values', ['attribute_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_attribute_values');
  }
};