'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_types', {
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
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE' 
      },
      code: { 
        type: Sequelize.STRING(64), 
        allowNull: false, 
        unique: true 
      },
      name: { 
        type: Sequelize.STRING(160), 
        allowNull: false 
      },
      description: { 
        type:Sequelize.TEXT 
      },
      isActive: { 
        type:Sequelize.BOOLEAN, 
        allowNull: false, 
        defaultValue: true, 
        field: 'is_active' 
      },
      createdAt:{ 
        type:Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at',
        defaultValue: Sequelize.NOW
      },
      updatedAt:{ 
        type:Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      },
    });

    await queryInterface.addIndex('product_types', ['company_id']);
    await queryInterface.addIndex('product_types', ['is_active']);
    await queryInterface.addConstraint('product_types', { 
      fields:['company_id','code'], 
      type:'unique', 
      name:'uniq_producttype_company_code' 
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_types');
  }
};