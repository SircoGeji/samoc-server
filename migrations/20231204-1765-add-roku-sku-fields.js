'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    // adding "strikeThroughPrice" field to Roku_SkuField table
    await queryInterface.sequelize.query(`
        INSERT INTO Roku_SkuField (id, storeId, name, type, translatable, required, \`order\`) VALUES (18, 1, 'strikethroughPrice', 'string', 1, 0, 18);
    `);
    // adding "bulletDescription" field to Roku_SkuField table
    await queryInterface.sequelize.query(`
        INSERT INTO Roku_SkuField (id, storeId, name, type, translatable, required, \`order\`) VALUES (19, 1, 'bulletDescription', 'string', 1, 0, 19);
    `);
    // adding "priceFormatted" to Roku_SkuField table
    await queryInterface.sequelize.query(`
        INSERT INTO Roku_SkuField (id, storeId, name, type, translatable, required, \`order\`) VALUES (20, 1, 'priceFormatted', 'string', 1, 0, 20);
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
