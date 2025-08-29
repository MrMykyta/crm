'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_type_attributes', {
      id: { 
        type: Sequelize.UUID, 
        primaryKey: true, 
        allowNull: false, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'company_id',
        references: { 
          model: 'companies', 
          key: 'id' 
        }, 
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE' 
      },
      productTypeId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'product_type_id',
        references: { 
          model: 'product_types', 
          key: 'id' 
        }, 
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE' 
      },
      attributeId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'attribute_id',
        references: { 
          model: 'attributes', 
          key: 'id' 
        }, 
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE' 
      },
      isRequired: { 
        type: Sequelize.BOOLEAN, 
        allowNull: false, 
        defaultValue: false, 
        field: 'is_required' 
      },
      isVariant:  { 
        type: Sequelize.BOOLEAN, 
        allowNull: false, 
        defaultValue: false, 
        field: 'is_variant' 
      },
      sortOrder:  { 
        type: Sequelize.INTEGER, 
        allowNull: false, 
        defaultValue: 0, 
        field: 'sort_order' 
      },
      createdAt:{ 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at',
        defaultValue: Sequelize.NOW
      },
      updatedAt:{ 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      },
    });

    await queryInterface.addConstraint('product_type_attributes', {
      fields:['product_type_id','attribute_id'], 
      type:'unique', 
      name:'uniq_producttype_attribute'
    });

    await queryInterface.addIndex('product_type_attributes', ['company_id']);

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_type_attributes');
  }
};