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
    // altering "Roku_StoreCopyField" table's "charLimit" column to allow NULL
    await queryInterface.sequelize.query(`
        ALTER TABLE Roku_StoreCopyField MODIFY COLUMN charLimit INT NULL;
    `);
    // altering "Android_StoreCopyField" table's "charLimit" column to allow NULL
    await queryInterface.sequelize.query(`
        ALTER TABLE Android_StoreCopyField MODIFY COLUMN charLimit INT NULL;
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
