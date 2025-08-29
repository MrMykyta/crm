'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_relations', {
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
      sourceProductId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'source_product_id',
        references: { 
          model: 'products', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      targetProductId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'target_product_id',
        references: { 
          model: 'products', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      relationType: { 
        type: Sequelize.ENUM('related','upsell','cross_sell','accessory','replacement','similar'), 
        allowNull: false, 
        field: 'relation_type' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at' 
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at' 
      }
    });

    await queryInterface.addConstraint('product_relations', {
      fields:['source_product_id','target_product_id','relation_type'],
      type:'unique', name:'uniq_product_relation'
    });

    await queryInterface.addIndex('product_relations', ['company_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_relations');
  }
};