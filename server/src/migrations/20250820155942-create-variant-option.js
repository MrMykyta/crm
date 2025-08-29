'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('variant_options', {
      id: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        primaryKey: true, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'company_id',
        references:{ 
          model: 'companies', 
          key: 'id' 
        }, 
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE'
      },
      variantId: {
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'variant_id',
        references: { 
          model: 'product_variants', 
          key: 'id' 
        }, 
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE'
      },
      name: { 
        type: Sequelize.STRING(64), 
        allowNull: false 
      },   // Color, Size
      value: { 
        type: Sequelize.STRING(160), 
        allowNull: false 
      },  // Red, XL
      sortOrder: { 
        type: Sequelize.INTEGER, 
        allowNull: false, 
        defaultValue: 0, 
        field: 'sort_order' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at',
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.fn('NOW')
      }
    });
    await queryInterface.addIndex('variant_options', ['company_id']);
    await queryInterface.addIndex('variant_options', ['variant_id']);
    await queryInterface.addConstraint('variant_options', {
      fields:['variant_id','name','value'],
      type:'unique', 
      name:'uniq_variant_option'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('variant_options');
  }
};