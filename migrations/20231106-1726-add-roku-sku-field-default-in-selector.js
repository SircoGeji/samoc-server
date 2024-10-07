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
    // incrementing "SkuFieldId" value from 6 entry in Roku_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuValue
            SET SkuFieldId = SkuFieldId + 1
            WHERE id <> 0 AND SkuFieldId >= 6
            ORDER BY id DESC;
    `);
    // incrementing "id" value in Roku_SkuField table from 6 entry
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET id = id + 1
            WHERE id >= 6
            ORDER BY id DESC;
    `);
    // incrementing "order" value in Roku_SkuField table from 6 value
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET \`order\` = \`order\` + 1
            WHERE id <> 0 AND \`order\` >= 6
            ORDER BY id DESC;
    `);
    // adding "isDefaultInSelector" field to Roku_SkuField table for google store
    await queryInterface.sequelize.query(`
        INSERT INTO Roku_SkuField (id, storeId, name, type, translatable, required, charLimit, \`order\`) VALUES (6, 1, 'isDefaultInSelector', 'boolean', 0, 0, null, 6);
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
