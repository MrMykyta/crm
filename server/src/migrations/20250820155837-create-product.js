'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
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
      brandId: { 
        type: Sequelize.UUID, 
        field:'brand_id', 
        references:{ 
          model:'brands', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'SET NULL' 
      },
      primaryCategoryId: { 
        type: Sequelize.UUID, 
        field:'primary_category_id', 
        references:{ 
          model:'categories', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'SET NULL' 
      },
      uomId: { 
        type: Sequelize.UUID, 
        field:'uom_id', 
        references:{ 
          model:'uoms', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'SET NULL' 
      },
      sku: { 
        type: Sequelize.STRING(64) 
      }, // артикул карточки (может повторяться у варианта)
      name: { 
        type: Sequelize.STRING(255), 
        allowNull:false 
      },
      slug: { 
        type: Sequelize.STRING(300), 
        allowNull:false
      },
      barcode: { 
        type: Sequelize.STRING(64) 
      },
      description: { 
        type: Sequelize.TEXT 
      },
      status: { 
        type: Sequelize.ENUM('draft','active','archived'), 
        allowNull:false, 
        defaultValue:'draft' 
      },
      visibility: { 
        type: Sequelize.ENUM('public','private'), 
        allowNull:false, 
        defaultValue:'public' 
      },
      currency: { 
        type: Sequelize.STRING(3), 
        allowNull:false, 
        defaultValue:'PLN' 
      },
      price: { 
        type: Sequelize.DECIMAL(14,2) 
      },
      oldPrice: { 
        type: Sequelize.DECIMAL(14,2), 
        field:'old_price' 
      },
      cost: { 
        type: Sequelize.DECIMAL(14,2) 
      },
      weight: { 
        type: Sequelize.DECIMAL(12,3) 
      },
      length: { 
        type: Sequelize.DECIMAL(12,3) 
      },
      width:  { 
        type: Sequelize.DECIMAL(12,3) 
      },
      height: { 
        type: Sequelize.DECIMAL(12,3) 
      },
      trackInventory: { 
        type: Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:false, 
        field:'track_inventory' 
      },
      publishedAt: { 
        type: Sequelize.DATE, 
        field:'published_at' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue: Sequelize.fn('NOW')
      }
    });
    await queryInterface.addIndex('products', ['company_id']);
    await queryInterface.addIndex('products', ['brand_id']);
    await queryInterface.addIndex('products', ['primary_category_id']);
    await queryInterface.addIndex('products', ['uom_id']);
    await queryInterface.addIndex('products', ['status']);

    await queryInterface.addConstraint('products', { 
      fields:['company_id','slug'], 
      type:'unique', 
      name:'uniq_product_company_slug' 
    });
    
    await queryInterface.addConstraint('products', { 
      fields:['company_id','sku'],  
      type:'unique', 
      name:'uniq_product_company_sku' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('products');
  }
};