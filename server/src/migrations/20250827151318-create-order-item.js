'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_items', {
      id: { 
        type: Sequelize.UUID, 
        primaryKey: true, 
        allowNull: false, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'company_id'
      },
      orderId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'orders', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'order_id'
      },
      variantId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'product_variants', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'RESTRICT',
        field: 'variant_id'
      },
      uomId: {
        type: Sequelize.UUID,
        references: { 
          model: 'uoms', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'uom_id'
      },
      sku: { 
        type: Sequelize.STRING(64) 
      },
      nameSnapshot: { 
        type: Sequelize.STRING(512),
        field:'name_snapshot' 
      },
      qty: { 
        type: Sequelize.DECIMAL(14,3), 
        allowNull: false, 
        defaultValue: 1 
      },
      priceNet: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false,
        field: 'price_net' 
      },
      priceGross: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false,
        field: 'price_gross'
      },
      taxRate: { 
        type: Sequelize.DECIMAL(5,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'tax_rate'
      },
      discountAmount: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'discount_amount'
      },
      priceListItemId: {
        type: Sequelize.UUID,
        references: { 
          model: 'price_list_items', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'price_list_item_id'
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at'
      },
      deletedAt: { 
        type: Sequelize.DATE,
        allowNull: true,
        field: 'deleted_at'
      }
    });
    await queryInterface.addIndex('order_items', ['order_id'], { 
      name: 'order_items_order_idx' 
    });
    await queryInterface.addIndex('order_items', ['variant_id'], { 
      name: 'order_items_variant_idx' 
    });
    await queryInterface.addConstraint('order_items', {
      fields: ['order_id','variant_id','sku'],
      type: 'unique',
      name: 'order_items_unique_order_variant_sku'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('order_items', 'order_items_unique_order_variant_sku');
    await queryInterface.dropTable('order_items');
  }
};