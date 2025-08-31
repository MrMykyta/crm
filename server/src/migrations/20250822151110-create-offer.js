'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('offers', {
      id: { 
        type: Sequelize.UUID,
        allowNull: false, 
        primaryKey: true, 
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
      customerId: {
        type: Sequelize.UUID, 
        allowNull: true,
        references: { 
          model: 'counterparties', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'customer_id'
      },
      currencyCode: { 
        type: Sequelize.STRING(3), 
        allowNull: false,
        field: 'currency_code'
      },
      status: { 
        type: Sequelize.ENUM('draft','sent','accepted','rejected','expired'), 
        allowNull: false, 
        defaultValue: 'draft' 
      },
      validUntil: { 
        type: Sequelize.DATE, 
        allowNull: true,
        field:'valid_until' 
      },
      totalNet: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'total_net'
      },
      totalTax: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'total_tax'
      },
      totalGross:{ 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'total_gross'
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
        allowNull: true 
      }
    });
    await queryInterface.addIndex('offers', ['company_id','created_at'],{
      name: 'offers_company_created_idx'
    });
    await queryInterface.addIndex('offers', ['company_id','status'],{
      name: 'offers_company_status_idx'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('offers');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_offers_status";`);
  }
};