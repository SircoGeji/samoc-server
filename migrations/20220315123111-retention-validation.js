'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    {
      const storesTable = await queryInterface.describeTable('Stores');
      if (!storesTable.hasOwnProperty('RlyPublicApiKeyStg')) {
        await queryInterface.sequelize.query(`
            ALTER TABLE Stores
                ADD COLUMN RlyPublicApiKeyStg VARCHAR(255) DEFAULT NULL NULL AFTER CFApiKey;`);
        await queryInterface.sequelize.query(`
            ALTER TABLE Stores
                ADD COLUMN RlyPublicApiKeyProd VARCHAR(255) DEFAULT NULL NULL AFTER RlyPublicApiKeyStg;`);
        await queryInterface.sequelize.query(`
            ALTER TABLE Stores
                ADD COLUMN IpAddress VARCHAR(64) DEFAULT NULL NULL AFTER RlyPublicApiKeyProd;`);
        await queryInterface.sequelize.query(`
            ALTER TABLE Stores
                ADD COLUMN PostalCode VARCHAR(64) DEFAULT NULL NULL AFTER IpAddress;`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
  },
}
