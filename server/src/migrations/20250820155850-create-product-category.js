'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_categories', {
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
          key:'id' }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE'
      },
      categoryId: {
        type: Sequelize.UUID, 
        allowNull:false, 
        field:'category_id',
        references:{ 
          model:'categories', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE'
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

    await queryInterface.addConstraint('product_categories', {
      fields: ['product_id','category_id'],
      type: 'unique',
      name: 'uniq_product_category'
    });

    await queryInterface.addIndex('product_categories', ['company_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_categories');
  }
};