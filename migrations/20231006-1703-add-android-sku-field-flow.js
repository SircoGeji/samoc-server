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
    // incrementing "SkuFieldId" value from 3 entry in Android_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuValue
            SET SkuFieldId = SkuFieldId + 1
            WHERE id <> 0 AND SkuFieldId >= 3
            ORDER BY id DESC;
    `);
    // incrementing "SkuFieldId" value from 17 entry in Android_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuValue
            SET SkuFieldId = SkuFieldId + 1
            WHERE id <> 0 AND SkuFieldId >= 17
            ORDER BY id DESC;
    `);
    // incrementing "order" value in Android_SkuField table from 3 entry
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuField
            SET \`order\` = \`order\` + 1
            WHERE id <> 0 AND \`order\` >= 3
            ORDER BY id DESC;
    `);
    // incrementing "id" value in Android_SkuField table from 3 entry
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuField
            SET id = id + 1
            WHERE id >= 3
            ORDER BY id DESC;
    `);
    // incrementing "id" value in Android_SkuField table from 17 entry
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuField
            SET id = id + 1
            WHERE id >= 17
            ORDER BY id DESC;
    `);
    // adding "flow" field to Android_SkuField table for google store
    await queryInterface.sequelize.query(`
        INSERT INTO Android_SkuField (id, storeId, name, type, translatable, required, charLimit, \`order\`) VALUES (3, 1, 'flow', 'string', 0, 0, null, 3);
    `);
    // adding "flow" field to Android_SkuField table for amazon store
    await queryInterface.sequelize.query(`
        INSERT INTO Android_SkuField (id, storeId, name, type, translatable, required, charLimit, \`order\`) VALUES (17, 2, 'flow', 'string', 0, 0, null, 3);
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
