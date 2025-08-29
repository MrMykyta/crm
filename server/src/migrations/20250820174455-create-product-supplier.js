'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_suppliers', {
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
      supplierId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'supplier_id',
        references: { 
          model: 'counterparties', 
          key: 'id' 
        }, 
        onDelete: 'RESTRICT', 
        onUpdate: 'CASCADE' 
      },
      supplierSku: { 
        type: Sequelize.STRING(128), 
        field: 'supplier_sku' 
      },
      currency: { 
        type: Sequelize.STRING(3), 
        defaultValue: 'PLN' 
      },
      price: { 
        type: Sequelize.DECIMAL(14,2),
        defaultValue: 0 
      },
      moq:{ 
        type: Sequelize.INTEGER, 
        defaultValue: 1 
      },
      leadTimeDays: { 
        type: Sequelize.INTEGER, 
        field: 'lead_time_days', 
        defaultValue: 0 
      },
      packSize: { 
        type: Sequelize.INTEGER, 
        field: 'pack_size', 
        defaultValue: 1 
      },
      url: { 
        type: Sequelize.STRING(512) 
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
    await queryInterface.addIndex('product_suppliers', ['company_id','supplier_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_suppliers');
  }
};