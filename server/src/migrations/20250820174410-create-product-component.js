'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_components', {
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
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      parentProductId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'parent_product_id',
        references: { 
          model: 'products', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      componentProductId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'component_product_id',
        references: { 
          model: 'products', 
          key: 'id' 
        }, 
        onDelete: 'RESTRICT', 
        onUpdate: 'CASCADE' 
      },
      componentVariantId: { 
        type: Sequelize.UUID, 
        field: 'component_variant_id',
        references: { 
          model: 'product_variants', 
          key: 'id' 
        }, 
        onDelete: 'SET NULL', 
        onUpdate: 'CASCADE' 
      },
      quantity: { 
        type: Sequelize.DECIMAL(14,4), 
        allowNull: false, 
        defaultValue: 1 
      },
      allowSubstitute: { 
        type: Sequelize.BOOLEAN, 
        allowNull: false, 
        defaultValue: false, 
        field: 'allow_substitute' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at',
        defaultValue: Sequelize.NOW
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('product_components', ['company_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_components'); 
  }
};