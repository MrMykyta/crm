'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_variants', {
      id: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        primaryKey: true, 
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
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE'
      },
      productId: {
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'product_id',
        references: { 
          model: 'products', 
          key: 'id' 
        }, 
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE'
      },
      sku: { 
        type: Sequelize.STRING(64), 
        allowNull: false, 
        unique: true 
      },
      barcode: { 
        type: Sequelize.STRING(64) 
      },
      currency: { 
        type: Sequelize.STRING(3), 
        allowNull: false, 
        defaultValue: 'PLN' 
      },
      price: { 
        type: Sequelize.DECIMAL(14,2) 
      },
      cost: { 
        type: Sequelize.DECIMAL(14,2) 
      },
      uomId: { 
        type: Sequelize.UUID, 
        field: 'uom_id', 
        references: { 
          model: 'uoms', 
          key: 'id' 
        }, 
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL' 
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
      isActive: { 
        type: Sequelize.BOOLEAN, 
        allowNull: false, 
        defaultValue: true, 
        field: 'is_active' 
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
      }
    });

    await queryInterface.addIndex('product_variants', ['company_id']);
    await queryInterface.addIndex('product_variants', ['product_id']);
    await queryInterface.addConstraint('product_variants', { 
      fields:['company_id','sku'], 
      type:'unique', 
      name:'uniq_variant_company_sku' 
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_variants');
  }
};