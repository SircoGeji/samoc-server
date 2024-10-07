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
    // altering "Android_Sku" table to have additional "needToPromote" column for promoting purposes
    await queryInterface.sequelize.query(`
        ALTER TABLE Android_Sku
            ADD COLUMN needToPromote BOOLEAN NOT NULL DEFAULT false AFTER promotedAt;
    `);
    // altering "Android_AppCopy" table to have additional "endedOn" column for publishing purposes
    await queryInterface.sequelize.query(`
        ALTER TABLE Android_AppCopy
            ADD COLUMN needToPromote BOOLEAN NOT NULL DEFAULT false AFTER promotedAt;
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
