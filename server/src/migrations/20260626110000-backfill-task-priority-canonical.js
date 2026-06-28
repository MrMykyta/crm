'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        UPDATE tasks
        SET priority = CASE
          WHEN priority IS NULL THEN 50
          WHEN priority = 1 THEN 25
          WHEN priority = 2 THEN 50
          WHEN priority = 3 THEN 75
          WHEN priority = 4 THEN 75
          WHEN priority = 5 THEN 100
          WHEN priority <= 17 THEN 10
          WHEN priority <= 37 THEN 25
          WHEN priority <= 62 THEN 50
          WHEN priority <= 87 THEN 75
          ELSE 100
        END
        WHERE priority IS NULL
           OR priority NOT IN (10, 25, 50, 75, 100)
      `, { transaction });
    });
  },

  async down() {
    // Irreversible data normalization: previous arbitrary priority values are not recoverable.
  },
};
