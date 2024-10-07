'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('UserEligibility');
    if (!table.hasOwnProperty('ProdData')) {
      await queryInterface.sequelize.query(
        `ALTER TABLE UserEligibility
            ADD COLUMN ProdData json DEFAULT NULL NULL AFTER DraftData`,
      );
    }
    if (!table.hasOwnProperty('StgData')) {
      await queryInterface.sequelize.query(
        `ALTER TABLE UserEligibility
            ADD COLUMN StgData json DEFAULT NULL NULL AFTER ProdData`,
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('UserEligibility', 'ProdData');
    await queryInterface.removeColumn('UserEligibility', 'StgData');
  },
};
