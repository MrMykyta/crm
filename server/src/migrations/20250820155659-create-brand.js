'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('brands', {
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
      name: { 
        type: Sequelize.STRING(128), 
        allowNull: false 
      },
      slug: { 
        type: Sequelize.STRING(160), 
        allowNull: false, 
        unique: true 
      },
      description: { 
        type: Sequelize.TEXT 
      },
      logoUrl: { 
        type: Sequelize.STRING(512), 
        field: 'logo_url' 
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
        defaultValue: Sequelize.NOW
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('brands', ['company_id']);
    await queryInterface.addIndex('brands', ['is_active']);
    await queryInterface.addConstraint('brands', { 
      fields:['company_id','slug'], 
      type:'unique', 
      name:'uniq_brand_company_slug' 
    });


  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('brands');
  }
};