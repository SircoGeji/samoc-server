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
    // drop Android_Sku table's extra columns that won't be useful in new publish flow
    await queryInterface.sequelize.query(`ALTER TABLE Android_Sku DROP COLUMN deployedTo;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_Sku DROP COLUMN endedOn;`);
    // add Android_Sku table's columns that will be used in new publish flow
    await queryInterface.sequelize.query(`ALTER TABLE Android_Sku ADD COLUMN envId INT NOT NULL DEFAULT 1 AFTER productId;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_Sku ADD COLUMN promotionId INT NULL AFTER envId;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_Sku ADD COLUMN hasChanges BOOLEAN NOT NULL DEFAULT false AFTER promotionId;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_Sku ADD COLUMN isPublished BOOLEAN NOT NULL DEFAULT false AFTER linkId;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_Sku ADD COLUMN isArchived BOOLEAN NOT NULL DEFAULT false AFTER status;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_Sku ADD COLUMN promotedAt datetime NULL AFTER updated;`);
    // drop Android_AppCopy table's extra columns that won't be useful in new publish flow
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy DROP COLUMN deployedTo;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy DROP COLUMN endedOn;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy DROP COLUMN activeOn;`);
    // add Android_AppCopy table's columns that will be used in new publish flow
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy ADD COLUMN isActive BOOLEAN NOT NULL DEFAULT false AFTER isDefault;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy ADD COLUMN envId INT NOT NULL DEFAULT 1 AFTER productId;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy ADD COLUMN promotionId INT NULL AFTER envId;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy ADD COLUMN hasChanges BOOLEAN NOT NULL DEFAULT false AFTER promotionId;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy ADD COLUMN isPublished BOOLEAN NOT NULL DEFAULT false AFTER isDefault;`);
    await queryInterface.sequelize.query(`ALTER TABLE Android_AppCopy ADD COLUMN promotedAt datetime NULL AFTER updated;`);
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
