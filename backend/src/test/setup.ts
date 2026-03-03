import 'dotenv/config';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/task_platform_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
