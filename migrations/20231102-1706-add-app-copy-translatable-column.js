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
    // altering "Android_Sku" table to have additional "deployedTo" column for publishing purposes
    await queryInterface.sequelize.query(`
        ALTER TABLE Android_AppCopyField
            ADD COLUMN translatable TINYINT(1) NOT NULL DEFAULT(1) AFTER type;
    `);
    // altering "Android_Sku" table to have additional "endedOn" column for publishing purposes
    await queryInterface.sequelize.query(`
        ALTER TABLE Roku_AppCopyField
            ADD COLUMN translatable TINYINT(1) NOT NULL DEFAULT(1) AFTER type;
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
