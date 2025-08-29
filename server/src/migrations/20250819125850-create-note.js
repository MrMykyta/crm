'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notes', {
      id: { 
        type: Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull:false,
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'company_id'
      },
      ownerType: {
        type: Sequelize.ENUM('counterparty','deal','task','order','offer','product','contact','user','company','department'),
        allowNull:false,
        field: 'owner_type'
      },
      ownerId: { 
        type: Sequelize.UUID, 
        allowNull:false,
        field: 'owner_id'
      },
      authorUserId: {
        type: Sequelize.UUID, 
        allowNull:false,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        field: 'author_user_id'
      },
      visibility: { 
        type: Sequelize.ENUM('private','company'), 
        allowNull:false, 
        defaultValue:'company' 
      },
      content: { 
        type: Sequelize.TEXT, 
        allowNull:false 
      },
      pinned: { 
        type: Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:false 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at'
      },
      deletedAt: { 
        type: Sequelize.DATE, 
        allowNull:true,
        field: 'deleted_at'
      }
    });

    await queryInterface.addIndex('notes', ['company_id','owner_type','owner_id'], { 
      name: 'idx_notes_company_owner' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('notes', 'idx_notes_company_owner');
    await queryInterface.dropTable('notes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notes_owner_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notes_visibility";');
  }
};