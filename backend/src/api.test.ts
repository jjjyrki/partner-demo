import request from "supertest";
import app from "./app";
import { resetDatabase, closeDatabase } from "./test/helpers";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require("./db/models");

describe("Task Platform API", () => {
  async function registerAndLogin(username: string, password: string) {
    await request(app).post("/auth/register").send({ username, password });
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ username, password });
    return loginRes.body.token as string;
  }

  beforeAll(async () => {
    jest.setTimeout(15000);
    await resetDatabase();
  }, 15000);

  afterEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("Auth", () => {
    it("registers a new user", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ username: "testuser", password: "password123" });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe("testuser");
      expect(res.body.user.kyc_status).toBe("approved");
    });

    it("rejects duplicate username", async () => {
      await request(app)
        .post("/auth/register")
        .send({ username: "testuser", password: "password123" });

      const res = await request(app)
        .post("/auth/register")
        .send({ username: "testuser", password: "password456" });
      expect(res.status).toBe(409);
    });

    it("logs in with valid credentials", async () => {
      await request(app)
        .post("/auth/register")
        .send({ username: "testuser", password: "password123" });

      const res = await request(app)
        .post("/auth/login")
        .send({ username: "testuser", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe("testuser");
    });

    it("rejects invalid password", async () => {
      await request(app)
        .post("/auth/register")
        .send({ username: "testuser", password: "password123" });

      const res = await request(app)
        .post("/auth/login")
        .send({ username: "testuser", password: "wrong" });
      expect(res.status).toBe(401);
    });

    it("returns current user with GET /auth/me", async () => {
      await request(app)
        .post("/auth/register")
        .send({ username: "testuser", password: "password123" });

      const loginRes = await request(app)
        .post("/auth/login")
        .send({ username: "testuser", password: "password123" });
      const token = loginRes.body.token;

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.username).toBe("testuser");
      expect(res.body.partner_user_id).toBeNull();
      expect(res.body.wallet).toBeDefined();
      expect(res.body.wallet.available_balance).toBe(1000); // $10 signup bonus
      expect(res.body.wallet.locked_balance).toBe(0);
    });
  });

  describe("User profile", () => {
    let token: string;

    beforeEach(async () => {
      token = await registerAndLogin("testuser", "password123");
    });

    it("updates username via PATCH /users/me", async () => {
      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "updateduser" });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe("updateduser");
    });

    it("updates password via PATCH /users/me", async () => {
      const res = await request(app)
        .patch("/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "newpassword123" });
      expect(res.status).toBe(200);
    });

    it("returns virtual card via GET /users/me/virtual-card", async () => {
      const res = await request(app)
        .get("/users/me/virtual-card")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.lastFour).toBe("4242");
      expect(res.body.brand).toBe("Visa");
      expect(res.body.holderName).toBe("testuser");
      expect(res.body.expiryMonth).toBe(12);
      expect(res.body.expiryYear).toBe(28);
      expect(res.body.maskedCvv).toBe("•••");
      expect(res.body.cvvRevealed).toBe("123");
    });

    it("can login with new password", async () => {
      await request(app)
        .patch("/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "newpassword123" });

      const res = await request(app)
        .post("/auth/login")
        .send({ username: "testuser", password: "newpassword123" });
      expect(res.status).toBe(200);
    });

    it("creates and links partner user via POST /users/me/create-partner-user", async () => {
      const createRes = await request(app)
        .post("/users/me/create-partner-user")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "Test",
          lastName: "User",
          dob: "1990-01-01",
          country: "ZM",
          phoneNumber: "+260970000001",
          email: "test.user@example.com",
        });
      expect(createRes.status).toBe(201);
      expect(typeof createRes.body.partner_user_id).toBe("string");
      expect(createRes.body.partner_user.workflowRunId).toBeDefined();
      expect(createRes.body.partner_user.kycUrl).toBeDefined();

      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.partner_user_id).toBe(createRes.body.partner_user_id);
    });
  });

  describe("Tasks - create with funds", () => {
    let ownerToken: string;
    let completerToken: string;

    beforeEach(async () => {
      ownerToken = await registerAndLogin("owneruser", "password123");
      completerToken = await registerAndLogin("completer", "password123");

      const ownerMeRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${ownerToken}`);
      const ownerId = ownerMeRes.body.id as number;

      await db.Wallet.update(
        { available_balance: 10000 },
        { where: { user_id: ownerId } },
      );
    });

    it("rejects task creation with insufficient funds", async () => {
      const res = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Test Task",
          description: "Test",
          steps: [{ label: "Step 1" }],
          reward_amount: 999999,
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Insufficient");
    });

    it("creates task with sufficient funds and locks reward", async () => {
      const res = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Review photos",
          description: "Check images",
          steps: [{ label: "Download" }, { label: "Review" }],
          reward_amount: 500,
        });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Review photos");
      expect(res.body.reward_amount).toBe(500);
      expect(res.body.TaskSteps).toHaveLength(2);

      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(meRes.body.wallet.available_balance).toBe(9500);
      expect(meRes.body.wallet.locked_balance).toBe(500);
    });

    it("updates task and increases reward (locks more)", async () => {
      const createRes = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Initial reward task",
          description: "Initial setup",
          steps: [{ label: "Collect" }, { label: "Upload" }],
          reward_amount: 500,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      const res = await request(app)
        .patch(`/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ reward_amount: 700 });
      expect(res.status).toBe(200);
      expect(res.body.reward_amount).toBe(700);

      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(meRes.body.wallet.available_balance).toBe(9300);
      expect(meRes.body.wallet.locked_balance).toBe(700);
    });

    it("updates task and decreases reward (releases funds)", async () => {
      const createRes = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Review videos",
          description: "Check clips",
          steps: [{ label: "Watch" }, { label: "Summarize" }],
          reward_amount: 500,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      const res = await request(app)
        .patch(`/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ reward_amount: 300 });
      expect(res.status).toBe(200);

      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(meRes.body.wallet.available_balance).toBe(9700);
      expect(meRes.body.wallet.locked_balance).toBe(300);
    });

    it("submits task completion with all step IDs", async () => {
      const createRes = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Submit task",
          steps: [{ label: "Step 1" }, { label: "Step 2" }],
          reward_amount: 300,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      const taskRes = await request(app)
        .get(`/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      const stepIds = taskRes.body.TaskSteps.map((s: { id: number }) => s.id);

      const res = await request(app)
        .post(`/tasks/${taskId}/submit`)
        .set("Authorization", `Bearer ${completerToken}`)
        .send({ completed_step_ids: stepIds });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("in_review");
    });

    it("rejects submission without all step IDs", async () => {
      const createRes = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Another task",
          steps: [{ label: "A" }, { label: "B" }],
          reward_amount: 100,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      const taskRes = await request(app)
        .get(`/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      const stepIds = taskRes.body.TaskSteps.map((s: { id: number }) => s.id);

      const res = await request(app)
        .post(`/tasks/${taskId}/submit`)
        .set("Authorization", `Bearer ${completerToken}`)
        .send({ completed_step_ids: [stepIds[0]] });
      expect(res.status).toBe(400);
    });

    it("approves submission and transfers payout", async () => {
      const createRes = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Approval task",
          steps: [{ label: "Do it" }],
          reward_amount: 300,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      const submitRes = await request(app)
        .post(`/tasks/${taskId}/submit`)
        .set("Authorization", `Bearer ${completerToken}`)
        .send({ completed_step_ids: [createRes.body.TaskSteps[0].id] });
      expect(submitRes.status).toBe(200);

      const res = await request(app)
        .post(`/tasks/${taskId}/approve`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("completed");

      const ownerMe = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${ownerToken}`);
      const completerMe = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${completerToken}`);
      expect(ownerMe.body.wallet.locked_balance).toBe(0);
      expect(completerMe.body.wallet.available_balance).toBe(1300); // 1000 signup + 300 reward
    });

    it("approve pays exactly once (idempotency)", async () => {
      const createRes = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Idempotency task",
          steps: [{ label: "Step" }],
          reward_amount: 300,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      const submitRes = await request(app)
        .post(`/tasks/${taskId}/submit`)
        .set("Authorization", `Bearer ${completerToken}`)
        .send({ completed_step_ids: [createRes.body.TaskSteps[0].id] });
      expect(submitRes.status).toBe(200);

      const approveRes = await request(app)
        .post(`/tasks/${taskId}/approve`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(approveRes.status).toBe(200);

      const res = await request(app)
        .post(`/tasks/${taskId}/approve`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);

      const completerMe = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${completerToken}`);
      expect(completerMe.body.wallet.available_balance).toBe(1300); // 1000 signup + 300 reward
    });

    it("delete/cancel task unlocks funds", async () => {
      const createRes = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Delete task",
          steps: [{ label: "Step" }],
          reward_amount: 300,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      const res = await request(app)
        .delete(`/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);

      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(meRes.body.wallet.available_balance).toBe(10000);
      expect(meRes.body.wallet.locked_balance).toBe(0);
    });
  });

  describe("Task chat", () => {
    let token: string;
    let taskId: number;

    beforeEach(async () => {
      token = await registerAndLogin("chatowner", "password123");
      const createRes = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Chat task",
          steps: [{ label: "Step" }],
          reward_amount: 50,
        });
      taskId = createRes.body.id;
    });

    it("creates and lists messages", async () => {
      const postRes = await request(app)
        .post(`/tasks/${taskId}/messages`)
        .set("Authorization", `Bearer ${token}`)
        .send({ body: "Hello from owner" });
      expect(postRes.status).toBe(201);
      expect(postRes.body.body).toBe("Hello from owner");

      const listRes = await request(app)
        .get(`/tasks/${taskId}/messages`)
        .set("Authorization", `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].body).toBe("Hello from owner");
      expect(listRes.body[0].User).toBeDefined();
    });
  });
});
