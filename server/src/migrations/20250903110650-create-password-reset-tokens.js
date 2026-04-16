'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface, Sequelize) {
    await queryInterface.createTable('password_reset_tokens', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.UUID, // убедись, что users.id тоже UUID
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'user_id',            // 👈 физическое имя колонки
      },
      tokenHash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
        field: 'token_hash',
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'expires_at',
      },
      usedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'used_at',
      },
      ip: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.STRING(512),
        allowNull: true,
        field: 'user_agent',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        field: 'created_at',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at',
      },
    });

    // 👉 индексы по ФАКТИЧЕСКИМ именам колонок
    await queryInterface.addIndex('password_reset_tokens', ['user_id']);
    await queryInterface.addIndex('password_reset_tokens', ['expires_at']);
    await queryInterface.addIndex('password_reset_tokens', ['token_hash'], { unique: true });
  },
    // Откатывает изменения, внесённые в up().
async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('password_reset_tokens');
  }
};
