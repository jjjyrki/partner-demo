"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("users");
    if (!table.partner_user_id) {
      await queryInterface.addColumn("users", "partner_user_id", {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("users");
    if (table.partner_user_id) {
      await queryInterface.removeColumn("users", "partner_user_id");
    }
  },
};
