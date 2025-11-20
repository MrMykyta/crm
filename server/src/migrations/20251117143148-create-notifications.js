"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("notifications", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "companies", key: "id" },
        field: "company_id",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        field: "user_id",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // что за событие
      type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      body: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // привязка к сущности (опционально)
      entityType: {
        type: Sequelize.STRING(64),
        allowNull: true,
        field: "entity_type",
      },
      entityId: {
        type: Sequelize.STRING(64),
        allowNull: true,
        field: "entity_id",
      },

      // доп. данные
      meta: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      isRead: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_read",
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
        field: "created_at",
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
        field: "updated_at",
      },
    });

    await queryInterface.addIndex("notifications", [
      "company_id",
      "user_id",
      "is_read",
    ]);
    await queryInterface.addIndex("notifications", [
      "company_id",
      "user_id",
      "created_at",
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("notifications");
  },
};
