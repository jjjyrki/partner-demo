import request from 'supertest';
import app from './app';
import { resetDatabase, closeDatabase } from './test/helpers';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('./db/models');

describe('Task Platform API', () => {
  beforeAll(async () => {
    jest.setTimeout(15000);
    await resetDatabase();
  }, 15000);

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Auth', () => {
    it('registers a new user', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ username: 'testuser', password: 'password123' });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('testuser');
      expect(res.body.user.kyc_status).toBe('approved');
    });

    it('rejects duplicate username', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ username: 'testuser', password: 'password456' });
      expect(res.status).toBe(409);
    });

    it('logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('testuser');
    });

    it('rejects invalid password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'testuser', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('returns current user with GET /auth/me', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('testuser');
      expect(res.body.wallet).toBeDefined();
      expect(res.body.wallet.available_balance).toBe(0);
      expect(res.body.wallet.locked_balance).toBe(0);
    });
  });

  describe('User profile', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password123' });
      token = res.body.token;
    });

    it('updates username via PATCH /users/me', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'updateduser' });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('updateduser');
    });

    it('updates password via PATCH /users/me', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'newpassword123' });
      expect(res.status).toBe(200);
    });

    it('can login with new password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'updateduser', password: 'newpassword123' });
      expect(res.status).toBe(200);
      token = res.body.token;
    });
  });

  describe('Tasks - create with funds', () => {
    let ownerToken: string;
    let completerToken: string;

    beforeAll(async () => {
      const ownerRes = await request(app)
        .post('/auth/login')
        .send({ username: 'updateduser', password: 'newpassword123' });
      ownerToken = ownerRes.body.token;

      await request(app)
        .post('/auth/register')
        .send({ username: 'completer', password: 'password123' });
      const completerRes = await request(app)
        .post('/auth/login')
        .send({ username: 'completer', password: 'password123' });
      completerToken = completerRes.body.token;

      await db.Wallet.update(
        { available_balance: 10000 },
        { where: { user_id: ownerRes.body.user.id } }
      );
    });

    it('rejects task creation with insufficient funds', async () => {
      const res = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Test Task',
          description: 'Test',
          steps: [{ label: 'Step 1' }],
          reward_amount: 999999,
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient');
    });

    it('creates task with sufficient funds and locks reward', async () => {
      const res = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Review photos',
          description: 'Check images',
          steps: [{ label: 'Download' }, { label: 'Review' }],
          reward_amount: 500,
        });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Review photos');
      expect(res.body.reward_amount).toBe(500);
      expect(res.body.TaskSteps).toHaveLength(2);

      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(meRes.body.wallet.available_balance).toBe(9500);
      expect(meRes.body.wallet.locked_balance).toBe(500);
    });

    it('updates task and increases reward (locks more)', async () => {
      const listRes = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`);
      const taskId = listRes.body[0].id;

      const res = await request(app)
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reward_amount: 700 });
      expect(res.status).toBe(200);
      expect(res.body.reward_amount).toBe(700);

      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(meRes.body.wallet.available_balance).toBe(9300);
      expect(meRes.body.wallet.locked_balance).toBe(700);
    });

    it('updates task and decreases reward (releases funds)', async () => {
      const listRes = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`);
      const taskId = listRes.body[0].id;

      const res = await request(app)
        .patch(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reward_amount: 300 });
      expect(res.status).toBe(200);

      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(meRes.body.wallet.available_balance).toBe(9700);
      expect(meRes.body.wallet.locked_balance).toBe(300);
    });

    it('submits task completion with all step IDs', async () => {
      const listRes = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`);
      const taskId = listRes.body[0].id;
      const taskRes = await request(app)
        .get(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const stepIds = taskRes.body.TaskSteps.map((s: { id: number }) => s.id);

      const res = await request(app)
        .post(`/tasks/${taskId}/submit`)
        .set('Authorization', `Bearer ${completerToken}`)
        .send({ completed_step_ids: stepIds });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_review');
    });

    it('rejects submission without all step IDs', async () => {
      await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Another task',
          steps: [{ label: 'A' }, { label: 'B' }],
          reward_amount: 100,
        });

      const listRes = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`);
      const openTask = listRes.body.find((t: { status: string }) => t.status === 'open');
      const taskId = openTask.id;
      const taskRes = await request(app)
        .get(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const stepIds = taskRes.body.TaskSteps.map((s: { id: number }) => s.id);

      const res = await request(app)
        .post(`/tasks/${taskId}/submit`)
        .set('Authorization', `Bearer ${completerToken}`)
        .send({ completed_step_ids: [stepIds[0]] });
      expect(res.status).toBe(400);
    });

    it('approves submission and transfers payout', async () => {
      const listRes = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`);
      const inReviewTask = listRes.body.find((t: { status: string }) => t.status === 'in_review');
      const taskId = inReviewTask.id;

      const res = await request(app)
        .post(`/tasks/${taskId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');

      const ownerMe = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      const completerMe = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${completerToken}`);
      expect(ownerMe.body.wallet.locked_balance).toBe(300);
      expect(completerMe.body.wallet.available_balance).toBe(300);
    });

    it('approve pays exactly once (idempotency)', async () => {
      const listRes = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`);
      const completedTask = listRes.body.find((t: { status: string }) => t.status === 'completed');
      const taskId = completedTask.id;

      const res = await request(app)
        .post(`/tasks/${taskId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);

      const completerMe = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${completerToken}`);
      expect(completerMe.body.wallet.available_balance).toBe(300);
    });

    it('delete/cancel task unlocks funds', async () => {
      const listRes = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${ownerToken}`);
      const openTask = listRes.body.find((t: { status: string }) => t.status === 'open');
      const taskId = openTask.id;

      const res = await request(app)
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);

      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(meRes.body.wallet.available_balance).toBe(9800);
      expect(meRes.body.wallet.locked_balance).toBe(0);
    });
  });

  describe('Task chat', () => {
    let token: string;
    let taskId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'updateduser', password: 'newpassword123' });
      token = res.body.token;

      const createRes = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Chat task',
          steps: [{ label: 'Step' }],
          reward_amount: 50,
        });
      taskId = createRes.body.id;
    });

    it('creates and lists messages', async () => {
      const postRes = await request(app)
        .post(`/tasks/${taskId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'Hello from owner' });
      expect(postRes.status).toBe(201);
      expect(postRes.body.body).toBe('Hello from owner');

      const listRes = await request(app)
        .get(`/tasks/${taskId}/messages`)
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].body).toBe('Hello from owner');
      expect(listRes.body[0].User).toBeDefined();
    });
  });
});
