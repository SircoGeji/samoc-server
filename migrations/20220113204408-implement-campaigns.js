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
      if (!offersTable.hasOwnProperty('StoreCode')) {
        await queryInterface.sequelize.query(`
            ALTER TABLE Offers
                ADD COLUMN StoreCode VARCHAR(50) NOT NULL AFTER OfferCode;`);
        await queryInterface.sequelize.query(`
            UPDATE Offers o SET StoreCode = (SELECT StoreCode FROM Plans WHERE PlanCode = o.PlanCode);`);
      }
      if (!offersTable.hasOwnProperty('Campaign')) {
        await queryInterface.sequelize.query(`
            ALTER TABLE Offers
                ADD COLUMN Campaign VARCHAR(255) NOT NULL AFTER StoreCode;`);
        await queryInterface.sequelize.query(`
            UPDATE Offers SET Campaign = OfferCode;`);
        await queryInterface.sequelize.query(`
            ALTER TABLE Offers ADD INDEX Campaign (Campaign ASC);`);
      }
    }
    {
      const retentionOffersTable = await queryInterface.describeTable(
        'RetentionOffers',
      );
      if (!retentionOffersTable.hasOwnProperty('Campaign')) {
        await queryInterface.sequelize.query(`
            ALTER TABLE RetentionOffers
                ADD COLUMN Campaign VARCHAR(255) NOT NULL AFTER StoreCode;`);
        await queryInterface.sequelize.query(`
            UPDATE RetentionOffers SET Campaign = OfferCode;`);
        await queryInterface.sequelize.query(`
            ALTER TABLE RetentionOffers ADD INDEX Campaign (Campaign ASC);`);
      }
    }
    await queryInterface.sequelize.query(`
        ALTER TABLE Offers
            DROP PRIMARY KEY,
            ADD PRIMARY KEY (OfferCode, StoreCode);`);
    await queryInterface.sequelize.query(`
        ALTER TABLE RetentionOffers
            DROP PRIMARY KEY,
            ADD PRIMARY KEY (OfferCode, StoreCode);`);
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
