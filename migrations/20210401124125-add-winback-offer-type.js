'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "INSERT INTO OfferTypes (OfferTypeID, Title) VALUES (3, 'Winback Offers')",
    );
  },

  down: async (queryInterface, Sequelize) => {
    // migration rollback can fail if there are winback offers created, delete them manually if needed
    await queryInterface.sequelize.query(
      'DELETE FROM OfferTypes WHERE OfferTypeID = 3',
    );
  },
};
