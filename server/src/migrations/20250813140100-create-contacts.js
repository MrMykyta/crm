'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contacts', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      // multitenant
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // принадлежность контрагенту
      counterpartyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'counterparty_id',
        references: { model: 'counterparties', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // ответственный пользователь в вашей компании
      mainResponsibleUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'main_responsible_user_id',
        references: { model: 'users', key: 'id' },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL',
      },

      // ФИО
      firstName: { type: Sequelize.STRING(100), allowNull: true, field: 'first_name' },
      lastName:  { type: Sequelize.STRING(100), allowNull: true, field: 'last_name' },
      middleName:{ type: Sequelize.STRING(100), allowNull: true, field: 'middle_name' },
      displayName:{ type: Sequelize.STRING(200), allowNull: true, field: 'display_name' }, // если хотите хранить как единое поле

      // работа
      jobTitle:   { type: Sequelize.STRING(120), allowNull: true, field: 'job_title' },
      department: { type: Sequelize.STRING(120), allowNull: true },

      // статус и флаги
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      isPrimary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_primary',
      },

      // доп
      notes: { type: Sequelize.TEXT, allowNull: true },

      // аудиты
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'created_by',
        references: { model: 'users', key: 'id' },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL',
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'updated_by',
        references: { model: 'users', key: 'id' },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL',
      },

      createdAt: { type: Sequelize.DATE, allowNull: false, field: 'created_at', defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, field: 'updated_at', defaultValue: Sequelize.fn('NOW') },
      deletedAt: { type: Sequelize.DATE, allowNull: true, field: 'deleted_at' },
    });

    await queryInterface.addIndex('contacts', ['company_id','counterparty_id'], { name: 'contacts_company_counterparty_idx' });
    await queryInterface.addIndex('contacts', ['company_id','status'],        { name: 'contacts_company_status_idx' });
    await queryInterface.addIndex('contacts', ['company_id','last_name'],     { name: 'contacts_company_lastname_idx' });
    await queryInterface.addIndex('contacts', ['company_id','job_title'],     { name: 'contacts_company_jobtitle_idx' });

    // единственный primary контакт на контрагента (среди не удалённых)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX contacts_primary_per_counterparty_uq
      ON contacts (company_id, counterparty_id)
      WHERE is_primary = true AND deleted_at IS NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS contacts_primary_per_counterparty_uq;');
    await queryInterface.removeIndex('contacts', 'contacts_company_jobtitle_idx');
    await queryInterface.removeIndex('contacts', 'contacts_company_lastname_idx');
    await queryInterface.removeIndex('contacts', 'contacts_company_status_idx');
    await queryInterface.removeIndex('contacts', 'contacts_company_counterparty_idx');
    await queryInterface.dropTable('contacts');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_contacts_status";');
  },
};