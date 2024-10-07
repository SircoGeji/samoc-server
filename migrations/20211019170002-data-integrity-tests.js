'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `
      ALTER TABLE Offers
          ADD COLUMN DataIntegrityStatus tinyint(1) DEFAULT NULL AFTER TotalUniqueCodes,
          ADD COLUMN DataIntegrityCheckTime datetime DEFAULT NULL AFTER DataIntegrityStatus,
          ADD COLUMN DataIntegrityErrorMessage varchar(255) DEFAULT NULL AFTER DataIntegrityCheckTime`,
    );
    await queryInterface.sequelize.query(
      `
      ALTER TABLE RetentionOffers
          ADD COLUMN DataIntegrityStatus tinyint(1) DEFAULT NULL AFTER GlRollbackVersion,
          ADD COLUMN DataIntegrityCheckTime datetime DEFAULT NULL AFTER DataIntegrityStatus,
          ADD COLUMN DataIntegrityErrorMessage varchar(255) DEFAULT NULL AFTER DataIntegrityCheckTime`,
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE Offers
          DROP COLUMN DataIntegrityErrorMessage,
          DROP COLUMN DataIntegrityCheckTime,
          DROP COLUMN DataIntegrityStatus
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE RetentionOffers 
          DROP COLUMN DataIntegrityErrorMessage,
          DROP COLUMN DataIntegrityCheckTime,
          DROP COLUMN DataIntegrityStatus
    `);
  },
};
