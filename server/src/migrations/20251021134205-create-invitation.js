'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invitations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'company_id'
      },
      email: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      firstName: {
        type: Sequelize.STRING(200),
        field: 'first_name'
      },
      lastName: {
        type: Sequelize.STRING(200), 
        field: 'last_name'
      },
      role: {
        type: Sequelize.ENUM('owner','admin','manager','viewer'),
        allowNull: false,
        defaultValue: 'viewer'
      },
      token: {
        type: Sequelize.STRING(200),
        allowNull: false,
        unique: true
      },
      expiresAt: {
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'expires_at'
      },
      acceptedAt: {
        type: Sequelize.DATE, 
        allowNull: true, 
        field: 'accepted_at'
      },
      status: {
        type: Sequelize.ENUM('pending','accepted','revoked','expired'),
        allowNull: false,
        defaultValue: 'pending'
      },
      invitedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL',
        field: 'invited_by'
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.NOW, 
        field: 'created_at' 
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.NOW, 
        field: 'updated_at' 
      }
    });

    await queryInterface.addIndex('invitations', ['company_id','status'], { name:'inv_company_status_idx' });
    await queryInterface.addIndex('invitations', ['email'], { name:'inv_email_idx' });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('invitations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_invitations_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_invitations_status";');
  }
};