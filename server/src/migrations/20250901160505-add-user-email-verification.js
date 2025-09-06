'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn('users', 'verification_token', { 
      type: Sequelize.STRING(128), 
      allowNull: true 
    });
    await queryInterface.addColumn('users', 'verification_expires_at', { 
      type: Sequelize.DATE, 
      allowNull: true, 
      field:'verification_expires_at' 
    });
    await queryInterface.addColumn('users', 'email_verified_at', { 
      type: Sequelize.DATE, 
      allowNull: true, 
      field: 'email_verified_at' 
    });

    await queryInterface.addIndex('users', ['verification_token'], { 
      unique: true, 
      name: 'uq_users_verification_token' });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeIndex('users', 'uq_users_verification_token');
    await queryInterface.removeColumn('users', 'email_verified_at');
    await queryInterface.removeColumn('users', 'verification_expires_at');
    await queryInterface.removeColumn('users', 'verification_token');
  }
};
