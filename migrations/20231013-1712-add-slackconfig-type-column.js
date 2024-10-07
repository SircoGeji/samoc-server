'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    // incrementing "SkuFieldId" value from 3 entry in Android_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        ALTER TABLE SlackConfig
            ADD COLUMN Type varchar(50) DEFAULT NULL AFTER Id
    `);
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
