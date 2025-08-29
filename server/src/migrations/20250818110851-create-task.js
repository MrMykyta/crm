'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks', {
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
      // связь с клиентом (опционально)
      counterpartyId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'counterparty_id',
        references: { 
          model: 'counterparties', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      // связь со сделкой (опционально)
      dealId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'deal_id',
        references: { 
          model: 'deals', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      title: { 
        type: Sequelize.STRING(256), 
        allowNull: false 
      },
      description: { 
        type: Sequelize.TEXT, 
        allowNull: true 
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'done', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium'
      },
      dueDate: { 
        type: Sequelize.DATE, 
        allowNull: true, 
        field: 'due_date' 
      },
      // кто создал
      creatorId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'creator_id',
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      // на ком висит задача
      assigneeId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'assignee_id',
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      // универсальный владелец (user/department) как у contact_points
      ownerType: {
        type: Sequelize.ENUM('user', 'department'),
        allowNull: false,
        defaultValue: 'user',
        field: 'owner_type'
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'owner_id'
        // без FK, чтобы не зависеть от точного имени таблицы департаментов
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


    await queryInterface.addConstraint('tasks', {
      fields: ['company_id','counterparty_id'],
      type: 'unique',
      name: 'uniq_tasks_company'
    });
    await queryInterface.addIndex('tasks', ['company_id']);
    await queryInterface.addIndex('tasks', ['counterparty_id']);
    await queryInterface.addIndex('tasks', ['deal_id']);
    await queryInterface.addIndex('tasks', ['assignee_id']);
    await queryInterface.addIndex('tasks', ['status']);
    await queryInterface.addIndex('tasks', ['priority']);
    await queryInterface.addIndex('tasks', ['due_date']);
    await queryInterface.addIndex('tasks', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('tasks', ['created_at']);
    await queryInterface.removeIndex('tasks', ['due_date']);
    await queryInterface.removeIndex('tasks', ['priority']);
    await queryInterface.removeIndex('tasks', ['status']);
    await queryInterface.removeIndex('tasks', ['assignee_id']);
    await queryInterface.removeIndex('tasks', ['deal_id']);
    await queryInterface.removeIndex('tasks', ['counterparty_id']);
    await queryInterface.removeIndex('tasks', ['company_id']);
    await queryInterface.dropTable('tasks');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_priority";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_owner_type";');
  }
};