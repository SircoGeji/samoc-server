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
    // incrementing "SkuFieldId" value from 5 entry in Roku_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuValue
            SET SkuFieldId = SkuFieldId + 1
            WHERE id <> 0 AND SkuFieldId >= 5
            ORDER BY id DESC;
    `);
    // setting "SkuFieldId" value "termDuration" field entry to 5 in Roku_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuValue
            SET SkuFieldId = 5
            WHERE id <> 0 AND SkuFieldId = 12
            ORDER BY id DESC;
    `);
    // incrementing "SkuFieldId" value from 6 entry in Roku_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuValue
            SET SkuFieldId = SkuFieldId + 1
            WHERE id <> 0 AND SkuFieldId >= 6
            ORDER BY id DESC;
    `);
    // decreasing "SkuFieldId" value from 14 entry in Roku_SkuValue table if any module exists
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuValue
            SET SkuFieldId = 14
            WHERE id <> 0 AND SkuFieldId = 15
            ORDER BY id DESC;
    `);
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuValue
            SET SkuFieldId = 15
            WHERE id <> 0 AND SkuFieldId = 16
            ORDER BY id DESC;
    `);
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuValue
            SET SkuFieldId = 16
            WHERE id <> 0 AND SkuFieldId = 17
            ORDER BY id DESC;
    `);
    // incrementing "id" value in Roku_SkuField table from 5 entry
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET id = id + 1
            WHERE id >= 5
            ORDER BY id DESC;
    `);
    // incrementing "order" value in Roku_SkuField table from 5 entry
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET \`order\` = \`order\` + 1
            WHERE id <> 0 AND \`order\` >= 5
            ORDER BY id DESC;
    `);
    // setting "id" value of "termDuration" entry field in Roku_SkuField table to 5
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET id = 5
            WHERE id <> 0 AND name = 'termDuration'
            ORDER BY id DESC;
    `);
    // setting "order" value of "termDuration" entry field in Roku_SkuField table to 5
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET \`order\` = 5
            WHERE id <> 0 AND name = 'termDuration'
            ORDER BY id DESC;
    `);
    // incrementing "id" value in Roku_SkuField table from 6 entry
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET id = id + 1
            WHERE id >= 6 AND id <= 13
            ORDER BY id DESC;
    `);
    // incrementing "order" value in Roku_SkuField table from 6 entry
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET \`order\` = \`order\` + 1
            WHERE id <> 0 AND \`order\` >= 6
            ORDER BY id DESC;
    `);
    // adding "flow" field to Roku_SkuField table for google store
    await queryInterface.sequelize.query(`
        INSERT INTO Roku_SkuField (id, storeId, name, type, translatable, required, charLimit, \`order\`) VALUES (6, 1, 'flow', 'string', 0, 0, null, 6);
    `);
    // decreasing "id" value in Roku_SkuField table from 15 entry
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET id = 14
            WHERE id <> 0 AND name = 'positiveButton'
            ORDER BY id DESC;
    `);
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET id = 15
            WHERE id <> 0 AND name = 'negativeButton'
            ORDER BY id DESC;
    `);
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET id = 16
            WHERE id <> 0 AND name = 'disclaimer'
            ORDER BY id DESC;
    `);
    // decreasing "order" value in Roku_SkuField table from 15 entry
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET \`order\` = 14
            WHERE id <> 0 AND name = 'positiveButton'
            ORDER BY id DESC;
    `);
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET \`order\` = 15
            WHERE id <> 0 AND name = 'negativeButton'
            ORDER BY id DESC;
    `);
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET \`order\` = 16
            WHERE id <> 0 AND name = 'disclaimer'
            ORDER BY id DESC;
    `);
    // changing termDuration field's "translatable" value in Roku_SkuField table to "false"
    await queryInterface.sequelize.query(`
        UPDATE Roku_SkuField
            SET translatable = false
            WHERE id <> 0 AND name = 'termDuration'
            ORDER BY id DESC;
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
