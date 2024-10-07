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
    // Adding new internal name column to track skufields
    await queryInterface.sequelize.query(`
        ALTER TABLE Android_SkuField 
        ADD COLUMN internalName char(64) AFTER name;
    `);
    // setting isDefaultInSelector internalName
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuField 
        set internalName = 'isDefaultInSelector' where ID = 12;
    `);
    // setting isDefaultInSelector internalName
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuField 
        set internalName = 'isDefaultInSelector' where ID = 27;
    `);

    await queryInterface.sequelize.query(`
        ALTER TABLE Roku_SkuField 
        ADD COLUMN internalName char(64) AFTER name;
    `);
    // setting isDefaultInSelector internalName
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField 
        set internalName = 'isDefaultInSelector' where ID = 6;
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
