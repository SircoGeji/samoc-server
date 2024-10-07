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
        INSERT INTO Roku_Environments (id, code, name) VALUES (1, 'dev', 'Client Dev');
    `);
    await queryInterface.sequelize.query(`
        INSERT INTO Roku_Environments (id, code, name) VALUES (2, 'prod', 'Production');
    `);
    // drop Roku_Sku table's extra columns that won't be useful in new publish flow
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_Sku DROP COLUMN deployedTo;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_Sku DROP COLUMN endedOn;`,
    );
    // add Roku_Sku table's columns that will be used in new publish flow
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_Sku ADD COLUMN envId INT NOT NULL DEFAULT 1 AFTER productId;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_Sku ADD COLUMN promotionId INT NULL AFTER envId;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_Sku ADD COLUMN hasChanges BOOLEAN NOT NULL DEFAULT false AFTER promotionId;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_Sku ADD COLUMN isPublished BOOLEAN NOT NULL DEFAULT false AFTER linkId;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_Sku ADD COLUMN isArchived BOOLEAN NOT NULL DEFAULT false AFTER status;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_Sku ADD COLUMN promotedAt datetime NULL AFTER updated;`,
    );
    // drop Roku_AppCopy table's extra columns that won't be useful in new publish flow
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy DROP COLUMN deployedTo;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy DROP COLUMN endedOn;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy DROP COLUMN activeOn;`,
    );
    // add Roku_AppCopy table's columns that will be used in new publish flow
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy ADD COLUMN isActive BOOLEAN NOT NULL DEFAULT false AFTER isDefault;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy ADD COLUMN envId INT NOT NULL DEFAULT 1 AFTER productId;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy ADD COLUMN promotionId INT NULL AFTER envId;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy ADD COLUMN hasChanges BOOLEAN NOT NULL DEFAULT false AFTER promotionId;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy ADD COLUMN isPublished BOOLEAN NOT NULL DEFAULT false AFTER isDefault;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE Roku_AppCopy ADD COLUMN promotedAt datetime NULL AFTER updated;`,
    );
    // altering "Roku_Sku" table to have additional "needToPromote" column for promoting purposes
    await queryInterface.sequelize.query(`
        ALTER TABLE Roku_Sku
            ADD COLUMN needToPromote BOOLEAN NOT NULL DEFAULT false AFTER promotedAt;
    `);
    // altering "Roku_AppCopy" table to have additional "endedOn" column for publishing purposes
    await queryInterface.sequelize.query(`
        ALTER TABLE Roku_AppCopy
            ADD COLUMN needToPromote BOOLEAN NOT NULL DEFAULT false AFTER promotedAt;
    `);
    // altering "Roku_Sku" table to have additional "stagedId" column for promoting to prod
    await queryInterface.sequelize.query(`
      ALTER TABLE Roku_Sku ADD COLUMN stagedId int NULL AFTER promotionId;
    `);
    // altering "Roku_Sku" table to have additional "stagedId" column for promoting to prod
    await queryInterface.sequelize.query(`
      ALTER TABLE Roku_AppCopy ADD COLUMN stagedId int NULL AFTER promotionId;
    `);
    // adding Stage environment to environments table for staged app copy and sku changes not yet accepted to prod
    await queryInterface.sequelize.query(`
      INSERT INTO Roku_Environments (code, name) VALUES ('stg', 'Stage');
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
