'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "INSERT INTO OfferTypes (OfferTypeID, Title) VALUES (4, 'Retention')",
    );
  },

  down: async (queryInterface, Sequelize) => {
    // migration rollback can fail if there are winback offers created, delete them manually if needed
    await queryInterface.sequelize.query(
      'DELETE FROM OfferTypes WHERE OfferTypeID = 4',
    );
  },
};
