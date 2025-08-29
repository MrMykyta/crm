'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_collections', {
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
      productId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'product_id',
        references: { 
          model: 'products', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      collectionId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'collection_id',
        references: { 
          model: 'collections', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
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
        defaultValue: Sequelize.NOW
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addConstraint('product_collections', {
      fields:['product_id','collection_id'], 
      type:'unique', 
      name:'uniq_product_collection'
    });
    await queryInterface.addIndex('product_collections', ['company_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_collections');
  }
};