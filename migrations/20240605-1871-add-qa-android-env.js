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

    // altering "Android_Environments" table "code" column to allow it to have longer strings
    await queryInterface.sequelize.query(
      `ALTER TABLE Android_Environments
        MODIFY COLUMN code CHAR(8) NOT NULL;`,
    );
    // updating "Android_Environments" table entries
    await queryInterface.sequelize.query(
      `UPDATE Android_Environments
        SET code = 'stg-qa', name = 'Stage QA'
        WHERE id = 2;`,
    );
    await queryInterface.sequelize.query(
      `UPDATE Android_Environments
        SET code = 'qa', name = 'QA'
        WHERE id = 3;`,
    );
    await queryInterface.sequelize.query(
      `INSERT INTO Android_Environments (id, code, name)
        VALUES (4, 'stg-prod', 'Stage Production');`,
    );
    await queryInterface.sequelize.query(
      `INSERT INTO Android_Environments (id, code, name)
        VALUES (5, 'prod', 'Production');`,
    );
    // updating "Android_AppCopy" table entries
    await queryInterface.sequelize.query(
      `UPDATE Android_AppCopy
        SET envId = 5
        WHERE id <> 0 AND envId = 2
        ORDER BY id DESC;`,
    );
    await queryInterface.sequelize.query(
      `UPDATE Android_AppCopy
        SET envId = 4
        WHERE id <> 0 AND envId = 3
        ORDER BY id DESC;`,
    );
    // updating "Android_Sku" table entries
    await queryInterface.sequelize.query(
      `UPDATE Android_Sku
        SET envId = 5
        WHERE id <> 0 AND envId = 2
        ORDER BY id DESC;`,
    );
    await queryInterface.sequelize.query(
      `UPDATE Android_Sku
        SET envId = 4
        WHERE id <> 0 AND envId = 3
        ORDER BY id DESC;`,
    );

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
