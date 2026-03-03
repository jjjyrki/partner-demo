# Task Platform Demo

A demo task platform where users create tasks and other users complete them for money.

## Tech Stack

- **Frontend**: Vite + React + TypeScript (planned)
- **Backend**: Node + Express + TypeScript
- **Database**: PostgreSQL
- **ORM**: Sequelize
- **Auth**: JWT + Argon2 password hashing
- **Validation**: Zod

## Prerequisites

- Node.js 18+
- PostgreSQL 16+ (or Docker)
- npm

## Quick Start

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

Or use a local PostgreSQL instance. Create a database:

```sql
CREATE DATABASE task_platform;
CREATE DATABASE task_platform_test;  -- for tests
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL if needed
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The API runs at http://localhost:3000.

### 3. Run Tests

```bash
cd backend
DATABASE_URL=postgres://postgres:postgres@localhost:5432/task_platform_test npm run test
```

Ensure PostgreSQL is running and the test database exists.

## API Endpoints

### Auth
- `POST /auth/register` - Register (username, password)
- `POST /auth/login` - Login
- `GET /auth/me` - Current user + wallet (requires Bearer token)

### Users
- `PATCH /users/me` - Update username/password (requires Bearer token)

### Tasks
- `POST /tasks` - Create task (locks reward from wallet)
- `GET /tasks` - List tasks (?status=open|in_review|completed|cancelled)
- `GET /tasks/:id` - Task details
- `PATCH /tasks/:id` - Update task (owner, open only)
- `DELETE /tasks/:id` - Cancel task (owner, open only)
- `POST /tasks/:id/submit` - Submit completion
- `POST /tasks/:id/approve` - Approve and payout

### Task Chat
- `GET /tasks/:id/messages` - List messages
- `POST /tasks/:id/messages` - Post message

## Demo Seed Data

- **alice** / password123 - 10000 cents, 1 open task
- **bob** / password123 - 5000 cents
- **charlie** / password123 - 2500 cents

## Demo Walkthrough

1. Login as alice, create a task with reward.
2. Login as bob, submit completion (include all step IDs).
3. Login as alice, approve submission → payout to bob.
4. Cancel an open task → locked funds return to owner.
