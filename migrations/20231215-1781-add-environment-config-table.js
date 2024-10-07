'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('EnvironmentConfig', {
        config: {
            type: 'VARCHAR(255)',
            primaryKey: true,
            allowNull: false
        },
        value: {
           type: 'VARCHAR(255)' 
        }
    });
    // adding androidTardisPassword to EnvironmentConfig
    await queryInterface.sequelize.query(`
    insert into EnvironmentConfig (config, \`value\`) values ('androidTardisPassword', 'admin_0123456789');
    `);
    // adding rokuTardisPassword to EnvironmentConfig
    await queryInterface.sequelize.query(`
    insert into EnvironmentConfig (config, \`value\`) values ('rokuTardisPassword', 'admin_0123456789');
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
