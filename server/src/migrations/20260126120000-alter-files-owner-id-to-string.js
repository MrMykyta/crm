'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('files', 'owner_id', {
      type: Sequelize.STRING(64),
      allowNull: false,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('files', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },
};
