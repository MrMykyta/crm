'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('user_companies', 'department_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { 
        model: 'company_departments', 
        key: 'id' 
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('user_companies', 'is_lead', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // (необязательно) индекс, чтобы быстрее искать по отделу
    await queryInterface.addIndex('user_companies', ['company_id', 'department_id'], {
      name: 'uc_company_department_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('user_companies', 'uc_company_department_idx').catch(()=>{});
    await queryInterface.removeColumn('user_companies', 'is_lead');
    await queryInterface.removeColumn('user_companies', 'department_id');
  }
};
