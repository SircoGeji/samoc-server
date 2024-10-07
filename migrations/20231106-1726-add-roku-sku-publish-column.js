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
    // altering "Roku_Sku" table to have additional "deployedTo" column for publishing purposes
    await queryInterface.sequelize.query(`
        ALTER TABLE Roku_Sku
            ADD COLUMN deployedTo VARCHAR(32) NULL AFTER linkId;
    `);
    // altering "Roku_Sku" table to have additional "endedOn" column for publishing purposes
    await queryInterface.sequelize.query(`
        ALTER TABLE Roku_Sku
            ADD COLUMN endedOn VARCHAR(32) NULL AFTER deployedTo;
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
