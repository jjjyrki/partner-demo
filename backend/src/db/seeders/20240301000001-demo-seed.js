'use strict';

const argon2 = require('argon2');
const { randomBytes } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const salt1 = randomBytes(32).toString('hex');
    const salt2 = randomBytes(32).toString('hex');
    const salt3 = randomBytes(32).toString('hex');

    const hash1 = await argon2.hash('password123' + salt1);
    const hash2 = await argon2.hash('password123' + salt2);
    const hash3 = await argon2.hash('password123' + salt3);

    await queryInterface.bulkInsert('users', [
      {
        username: 'alice',
        password_hash: hash1,
        password_salt: salt1,
        kyc_status: 'approved',
        created_at: now,
        updated_at: now,
      },
      {
        username: 'bob',
        password_hash: hash2,
        password_salt: salt2,
        kyc_status: 'approved',
        created_at: now,
        updated_at: now,
      },
      {
        username: 'charlie',
        password_hash: hash3,
        password_salt: salt3,
        kyc_status: 'approved',
        created_at: now,
        updated_at: now,
      },
    ]);

    const [userRows] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE username IN ('alice', 'bob', 'charlie') ORDER BY username"
    );
    const aliceId = userRows[0].id;
    const bobId = userRows[1].id;
    const charlieId = userRows[2].id;

    await queryInterface.bulkInsert('wallets', [
      { user_id: aliceId, available_balance: 10000, locked_balance: 0, status: 'active', updated_at: now },
      { user_id: bobId, available_balance: 5000, locked_balance: 0, status: 'active', updated_at: now },
      { user_id: charlieId, available_balance: 2500, locked_balance: 0, status: 'active', updated_at: now },
    ]);

    const [taskRows] = await queryInterface.sequelize.query(
      `INSERT INTO tasks (owner_user_id, title, description, reward_amount, status, created_at, updated_at)
       VALUES (${aliceId}, 'Review product photos', 'Check 50 product images for quality', 500, 'open', '${now.toISOString()}', '${now.toISOString()}')
       RETURNING id`
    );
    const taskId = taskRows[0]?.id;
    if (taskId) {
      await queryInterface.bulkInsert('task_steps', [
        { task_id: taskId, step_order: 1, label: 'Download images', created_at: now, updated_at: now },
        { task_id: taskId, step_order: 2, label: 'Review each image', created_at: now, updated_at: now },
        { task_id: taskId, step_order: 3, label: 'Submit quality report', created_at: now, updated_at: now },
      ]);

      await queryInterface.sequelize.query(
        `UPDATE wallets SET available_balance = available_balance - 500, locked_balance = locked_balance + 500 WHERE user_id = ${aliceId}`
      );

      await queryInterface.bulkInsert('task_messages', [
        { task_id: taskId, author_user_id: aliceId, body: 'Please ensure all images are at least 800x800px', created_at: now },
        { task_id: taskId, author_user_id: bobId, body: 'Got it, I will check the dimensions', created_at: now },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('task_messages', null, {});
    await queryInterface.bulkDelete('task_submissions', null, {});
    await queryInterface.bulkDelete('task_steps', null, {});
    await queryInterface.bulkDelete('tasks', null, {});
    await queryInterface.bulkDelete('wallets', null, {});
    await queryInterface.bulkDelete('users', null, {});
  },
};
