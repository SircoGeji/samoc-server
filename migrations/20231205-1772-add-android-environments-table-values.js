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
    await queryInterface.sequelize.query(`
        INSERT INTO Android_Environments (id, code, name) VALUES (1, 'dev', 'Client Dev');
    `);
    await queryInterface.sequelize.query(`
        INSERT INTO Android_Environments (id, code, name) VALUES (2, 'prod', 'Production');
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
