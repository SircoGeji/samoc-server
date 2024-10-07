'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    // disabling foreign key check
    await queryInterface.sequelize.query(`SET FOREIGN_KEY_CHECKS=0;`);
    // altering "Android_Sku" table to have additional "stagedId" column for promoting to prod
    await queryInterface.sequelize.query(`
      ALTER TABLE Android_Sku ADD COLUMN stagedId int NULL AFTER promotionId;
    `);
    // altering "Android_Sku" table to have additional "stagedId" column for promoting to prod
    await queryInterface.sequelize.query(`
      ALTER TABLE Android_AppCopy ADD COLUMN stagedId int NULL AFTER promotionId;
    `);
    // adding Stage environment to environments table for staged app copy and sku changes not yet accepted to prod
    await queryInterface.sequelize.query(`
      INSERT INTO Android_Environments (code, name) VALUES ('stg', 'Stage');
    `);
    // enabling foreign key check
    await queryInterface.sequelize.query(`SET FOREIGN_KEY_CHECKS=1;`);
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
