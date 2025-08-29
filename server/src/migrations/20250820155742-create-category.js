'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categories', {
      id: { 
        type: Sequelize.UUID, 
        allowNull:false, 
        primaryKey:true, 
        defaultValue: Sequelize.UUIDV4
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull:false, 
        field:'company_id',
        references:{ 
          model:'companies', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE'
      },
      parentId: { 
        type: Sequelize.UUID, 
        field:'parent_id', 
        references:{ 
        model:'categories', 
        key:'id' 
      }, 
      onUpdate:'CASCADE', 
      onDelete:'SET NULL' 
      },
      name: { 
        type: Sequelize.STRING(160), 
        allowNull:false 
      },
      slug: { 
        type: Sequelize.STRING(200), 
        allowNull:false 
      },
      path: { 
        type: Sequelize.STRING(1000), 
        allowNull:false 
      }, // например: /electronics/phones/
      description: { 
        type: Sequelize.TEXT 
      },
      isActive: { 
        type: Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:true, 
        field:'is_active' 
      },
      sortOrder: { 
        type: Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue:0, 
        field:'sort_order' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue: Sequelize.fn('NOW')
      }
    });
    await queryInterface.addIndex('categories', ['company_id']);
    await queryInterface.addIndex('categories', ['parent_id']);
    await queryInterface.addIndex('categories', ['company_id','path'], { 
      unique: true, 
      name: 'uniq_category_company_path' 
    });
    await queryInterface.addConstraint('categories', { 
      fields:['company_id','slug'], 
      type:'unique', 
      name:'uniq_category_company_slug' 
    });
    
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('categories');
  }
};