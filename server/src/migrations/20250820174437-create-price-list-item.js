'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('price_list_items', {
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
      priceListId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'price_list_id',
        references: { 
          model: 'price_lists', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      productId: { 
        type: Sequelize.UUID, 
        field: 'product_id',
        references: { 
          model: 'products', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      variantId: { 
        type: Sequelize.UUID, 
        field: 'variant_id',
        references: { 
          model: 'product_variants', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      minQty: { 
        type: Sequelize.INTEGER, 
        allowNull: false, 
        defaultValue: 1, 
        field: 'min_qty' 
      },
      price: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false,
        defaultValue: 0
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

    await queryInterface.addConstraint('price_list_items', {
      fields:['price_list_id','product_id','variant_id','min_qty'],
      type:'unique', 
      name:'uniq_pricelist_item'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('price_list_items');
  }
};