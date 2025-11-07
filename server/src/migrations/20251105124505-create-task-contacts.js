'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // migrations/XXXX-create-task-contacts.js
    await queryInterface.createTable('task_contacts', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      taskId: {
        type: Sequelize.UUID, allowNull: false, field: 'task_id',
        references: { model: 'tasks', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      contactId: {
        type: Sequelize.UUID, allowNull: false, field: 'contact_id',
        references: { model: 'contacts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, field: 'created_at', defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, field: 'updated_at', defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addConstraint('task_contacts', {
      fields: ['task_id', 'contact_id'],
      type: 'unique',
      name: 'uniq_task_contacts_task_contact',
    });
  },

  async down(queryInterface /*, Sequelize */) {
    await queryInterface.removeConstraint('task_contacts', 'uniq_task_contacts_task_contact');
    await queryInterface.dropTable('task_contacts');
  },
};