'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('offer_items', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4
      },
      offerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { 
          model: 'offers', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'offer_id'
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
        allowNull: true,
        references: { 
          model: 'uoms', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        field: 'uom_id'
      },
      sku: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      nameSnapshot: {
        type: Sequelize.STRING(512),
        allowNull: true,
        field: 'name_snapshot'
      },
      qty: {
        type: Sequelize.DECIMAL(14, 3),
        allowNull: false,
        defaultValue: 1
      },
      priceNet: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
        field: 'price_net',
      },
      priceGross: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
        field: 'price_gross',
      },
      taxRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'tax_rate'
      },
      discountAmount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'discount_amount'
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
      },
      deletedAt: {
        type: Sequelize.DATE,
        field: 'deleted_at',
        allowNull: true
      }
    });

    await queryInterface.addIndex('offer_items', ['offer_id'], { 
      name: 'offer_items_offer_idx' 
    });
    await queryInterface.addIndex('offer_items', ['variant_id'], { 
      name: 'offer_items_variant_idx' 
    });
    await queryInterface.addConstraint('offer_items', {
      fields: ['offer_id', 'variant_id', 'sku'],
      type: 'unique',
      name: 'offer_items_unique_offer_variant_sku'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('offer_items', 'offer_items_unique_offer_variant_sku');
    await queryInterface.dropTable('offer_items');
  }
};