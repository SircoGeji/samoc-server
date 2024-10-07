'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    {
      const offersTable = await queryInterface.describeTable('Offers');
      if (!offersTable.hasOwnProperty('CampaignName')) {
        await queryInterface.sequelize.query(`
            ALTER TABLE Offers
                ADD COLUMN CampaignName VARCHAR(255) NOT NULL AFTER Campaign;`);
      }
    }
    {
      const retentionOffersTable = await queryInterface.describeTable(
        'RetentionOffers',
      );
      if (!retentionOffersTable.hasOwnProperty('CampaignName')) {
        await queryInterface.sequelize.query(`
            ALTER TABLE RetentionOffers
                ADD COLUMN CampaignName VARCHAR(255) NOT NULL AFTER Campaign;`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
