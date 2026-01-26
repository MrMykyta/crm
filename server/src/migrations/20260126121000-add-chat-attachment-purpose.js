'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_files_purpose\" ADD VALUE IF NOT EXISTS 'chat_attachment';"
    );
  },
  async down() {
    // enum value removal is not supported safely; no-op
  },
};
