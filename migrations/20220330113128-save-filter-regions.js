'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('UserEligibility');
    if (!table.hasOwnProperty('Regions')) {
      await queryInterface.sequelize.query(
        `ALTER TABLE UserEligibility
            ADD COLUMN Regions VARCHAR(200) DEFAULT NULL AFTER StoreCode`,
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
