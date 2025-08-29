'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sequences', {
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
      scope: { 
        type: Sequelize.ENUM('offer','order'), 
        allowNull:false 
      },
      year: { 
        type: Sequelize.INTEGER, 
        allowNull:false 
      },
      value: { 
        type: Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue: 0 
      },
      createdAt: { 
        type: Sequelize.DATE,
         allowNull:false, 
         defaultValue: Sequelize.fn('NOW') ,
         field: 'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at'
      }
    });

    await queryInterface.addConstraint('sequences', {
      fields: ['company_id','scope','year'],
      type: 'unique',
      name: 'uniq_sequences_company_scope_year'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('sequences', 'uniq_sequences_company_scope_year');
    await queryInterface.dropTable('sequences');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sequences_scope";');
  }
};