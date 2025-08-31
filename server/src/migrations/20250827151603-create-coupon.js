'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('coupons', {
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
      code: { 
        type: Sequelize.STRING(64), 
        allowNull: false 
      },
      promotionId: {
        type: Sequelize.UUID,
        references: { 
          model: 'promotions', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'promotion_id'
      },
      usageLimit: { 
        type: Sequelize.INTEGER,
        field: 'usage_limit' 
      },
      usedCount: { 
        type: Sequelize.INTEGER, 
        allowNull: false, 
        defaultValue: 0,
        field: 'used_count'
      },
      validFrom: { 
        type: Sequelize.DATE,
        field: 'valid_from'
      }, 
      validTo: { 
        type: Sequelize.DATE,
        field: 'valid_to'  
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
        type: Sequelize.DATE ,
        allowNull: true,
        field: 'deleted_at'
      }
    });
    await queryInterface.addConstraint('coupons', {
      fields: ['company_id','code'],
      type: 'unique',
      name: 'coupons_company_code_unique'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('coupons','coupons_company_code_unique');
    await queryInterface.dropTable('coupons');
  }
};