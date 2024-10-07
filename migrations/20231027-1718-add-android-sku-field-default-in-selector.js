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
    // incrementing "SkuFieldId" value from 12 entry in Android_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuValue
            SET SkuFieldId = SkuFieldId + 1
            WHERE id <> 0 AND SkuFieldId >= 12
            ORDER BY id DESC;
    `);
    // incrementing "id" value in Android_SkuField table from 12 entry
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuField
            SET id = id + 1
            WHERE id >= 12
            ORDER BY id DESC;
    `);
    // incrementing "order" value in Android_SkuField table from 12 value
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuField
            SET \`order\` = \`order\` + 1
            WHERE id <> 0 AND \`order\` >= 12
            ORDER BY id DESC;
    `);
    // adding "defaultInSelector" field to Android_SkuField table for google store
    await queryInterface.sequelize.query(`
        INSERT INTO Android_SkuField (id, storeId, name, type, translatable, required, charLimit, \`order\`) VALUES (12, 1, 'isDefaultInSelector', 'boolean', 0, 0, null, 12);
    `);
    // incrementing "SkuFieldId" value from 27 entry in Android_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuValue
            SET SkuFieldId = SkuFieldId + 1
            WHERE id <> 0 AND SkuFieldId >= 27
            ORDER BY id DESC;
    `);
    // incrementing "id" value in Android_SkuField table from 27 entry
    await queryInterface.sequelize.query(`
        UPDATE Android_SkuField
            SET id = id + 1
            WHERE id >= 27
            ORDER BY id DESC;
    `);
    // adding "defaultInSelector" field to Android_SkuField table for amazon store
    await queryInterface.sequelize.query(`
        INSERT INTO Android_SkuField (id, storeId, name, type, translatable, required, charLimit, \`order\`) VALUES (27, 2, 'isDefaultInSelector', 'boolean', 0, 0, null, 12);
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
