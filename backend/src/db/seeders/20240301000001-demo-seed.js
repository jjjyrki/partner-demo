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

    const taskSpecs = [
      // 1 task for bob
      { ownerId: bobId, title: 'Data entry for spreadsheet', description: 'Enter 100 rows of data from PDF', reward: 300 },
      // 5 tasks for alice (1 existing below + 4 more)
      { ownerId: aliceId, title: 'Review product photos', description: 'Check 50 product images for quality', reward: 500 },
      { ownerId: aliceId, title: 'Write product descriptions', description: 'Write 20 short product descriptions', reward: 400 },
      { ownerId: aliceId, title: 'Transcribe audio file', description: 'Transcribe 10 min interview to text', reward: 350 },
      { ownerId: aliceId, title: 'Social media graphics', description: 'Create 5 Instagram post graphics', reward: 600 },
      { ownerId: aliceId, title: 'Customer support tickets', description: 'Respond to 15 support tickets', reward: 250 },
      // 3 tasks for charlie
      { ownerId: charlieId, title: 'Translate document', description: 'Translate 2-page document to Spanish', reward: 400 },
      { ownerId: charlieId, title: 'Video editing', description: 'Edit 5 min video with captions', reward: 500 },
      { ownerId: charlieId, title: 'Research competitors', description: 'Compile competitor pricing report', reward: 300 },
    ];

    const stepLabels = ['Get started', 'Complete work', 'Submit for review'];
    let aliceLocked = 0;
    let bobLocked = 0;
    let charlieLocked = 0;

    for (const spec of taskSpecs) {
      const [rows] = await queryInterface.sequelize.query(
        `INSERT INTO tasks (owner_user_id, title, description, reward_amount, status, created_at, updated_at)
         VALUES (${spec.ownerId}, '${spec.title.replace(/'/g, "''")}', '${(spec.description || '').replace(/'/g, "''")}', ${spec.reward}, 'open', '${now.toISOString()}', '${now.toISOString()}')
         RETURNING id`
      );
      const taskId = rows[0]?.id;
      if (taskId) {
        await queryInterface.bulkInsert('task_steps', stepLabels.map((label, i) => ({
          task_id: taskId, step_order: i + 1, label, created_at: now, updated_at: now,
        })));

        if (spec.ownerId === aliceId) aliceLocked += spec.reward;
        else if (spec.ownerId === bobId) bobLocked += spec.reward;
        else if (spec.ownerId === charlieId) charlieLocked += spec.reward;
      }
    }

    await queryInterface.sequelize.query(
      `UPDATE wallets SET available_balance = available_balance - ${aliceLocked}, locked_balance = locked_balance + ${aliceLocked} WHERE user_id = ${aliceId}`
    );
    await queryInterface.sequelize.query(
      `UPDATE wallets SET available_balance = available_balance - ${bobLocked}, locked_balance = locked_balance + ${bobLocked} WHERE user_id = ${bobId}`
    );
    await queryInterface.sequelize.query(
      `UPDATE wallets SET available_balance = available_balance - ${charlieLocked}, locked_balance = locked_balance + ${charlieLocked} WHERE user_id = ${charlieId}`
    );

    // Add demo messages to first alice task
    const [aliceTaskRows] = await queryInterface.sequelize.query(
      `SELECT id FROM tasks WHERE owner_user_id = ${aliceId} ORDER BY id LIMIT 1`
    );
    const firstAliceTaskId = aliceTaskRows[0]?.id;
    if (firstAliceTaskId) {
      await queryInterface.bulkInsert('task_messages', [
        { task_id: firstAliceTaskId, author_user_id: aliceId, body: 'Please ensure all images are at least 800x800px', created_at: now },
        { task_id: firstAliceTaskId, author_user_id: bobId, body: 'Got it, I will check the dimensions', created_at: now },
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
