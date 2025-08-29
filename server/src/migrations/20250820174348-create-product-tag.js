'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_tags', {
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
        type:Sequelize.UUID, 
        allowNull: false, 
        field: 'product_id',
        references: { 
          model: 'products', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      tagId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'tag_id',
        references: { 
          model: 'tags', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
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

    await queryInterface.addConstraint('product_tags', {
      fields:['product_id','tag_id'], 
      type:'unique', 
      name:'uniq_product_tag'
    });

    await queryInterface.addIndex('product_tags', ['company_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_tags');
  }
};