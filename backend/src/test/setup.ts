import "dotenv/config";

process.env.NODE_ENV = "test";
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5433/task_platform_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
