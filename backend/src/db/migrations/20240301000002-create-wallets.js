'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallets', {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      available_balance: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      locked_balance: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE wallets ADD CONSTRAINT wallets_available_balance_non_negative CHECK (available_balance >= 0)'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE wallets ADD CONSTRAINT wallets_locked_balance_non_negative CHECK (locked_balance >= 0)'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_available_balance_non_negative'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_locked_balance_non_negative'
    );
    await queryInterface.dropTable('wallets');
  },
};
