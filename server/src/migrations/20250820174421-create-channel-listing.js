'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('channel_listings', {
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
      channelId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'channel_id',
        references: { 
          model: 'channels', 
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
      state: { 
        type: Sequelize.ENUM('draft','ready','published','archived','error'), 
        allowNull: false, 
        defaultValue: 'draft' 
      },
      channelSku: { 
        type: Sequelize.STRING(128), 
        field: 'channel_sku' 
      },
      currency: { 
        type: Sequelize.STRING(3), 
        defaultValue: 'PLN' 
      },
      price: { 
        type: Sequelize.DECIMAL(14,2),
        defaultValue: 0 
      },
      title: { 
        type: Sequelize.STRING(255) 
      },
      description: { 
        type: Sequelize.TEXT 
      },
      data: { 
        type: Sequelize.JSONB 
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

    await queryInterface.addIndex('channel_listings', ['company_id','channel_id','product_id','variant_id'], { 
      name:'idx_listing_combo' 
    });

    await queryInterface.addConstraint('channel_listings', {
      fields:['channel_id','variant_id'],
      type:'unique', 
      name:'uniq_listing_channel_variant'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('channel_listings');
  }
};