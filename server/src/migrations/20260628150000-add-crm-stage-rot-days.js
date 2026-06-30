'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'crm_pipeline_stages', 'rot_days'))) {
      await queryInterface.addColumn('crm_pipeline_stages', 'rot_days', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'crm_pipeline_stages', 'rot_days')) {
      await queryInterface.removeColumn('crm_pipeline_stages', 'rot_days');
    }
  },
};
