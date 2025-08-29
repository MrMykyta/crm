'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_localizations', {
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
      locale: { 
        type: Sequelize.STRING(12), 
        allowNull: false 
      },
      slug: { 
        type: Sequelize.STRING(320), 
        allowNull: false 
      },
      name: { 
        type: Sequelize.STRING(255), 
        allowNull: false 
      },
      shortDescription: { 
        type: Sequelize.TEXT, 
        field: 'short_description' 
      },
      longDescription: { 
        type: Sequelize.TEXT, 
        field: 'long_description' 
      },
      seoTitle: { 
        type: Sequelize.STRING(255), 
        field: 'seo_title' 
      },
      seoDescription: { 
        type: Sequelize.STRING(512), 
        field: 'seo_description' 
      },
      seoKeywords: { 
        type: Sequelize.STRING(512), 
        field: 'seo_keywords' 
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

    await queryInterface.addConstraint('product_localizations', {
      fields:['product_id','locale'], 
      type:'unique', 
      name:'uniq_product_locale'
    });

    await queryInterface.addIndex('product_localizations', ['company_id']);
    await queryInterface.addIndex('product_localizations', ['slug']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_localizations');
  }
};