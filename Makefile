.PHONY: setup setup-backend run-backend setup-frontend run-frontend postgres db-create db-drop db-migrate db-seed test test-backend test-frontend help

help:
	@echo "Task Platform Demo - Makefile targets"
	@echo ""
	@echo "  make setup          - Setup everything (postgres, backend, frontend)"
	@echo "  make setup-backend  - Setup backend (postgres, deps, migrate, seed)"
	@echo "  make run-backend    - Start backend dev server (port 3000)"
	@echo "  make setup-frontend - Setup frontend (deps)"
	@echo "  make run-frontend   - Start frontend dev server (port 5173)"
	@echo "  make test           - Run backend and frontend tests"
	@echo "  make postgres       - Start PostgreSQL via docker-compose"
	@echo "  make db-create      - Create task_platform database (if not exists)"
	@echo "  make db-drop        - Drop task_platform database and all its data"
	@echo "  make db-migrate     - Run database migrations"
	@echo "  make db-seed        - Seed database with demo data"
	@echo ""

postgres:
	docker-compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		docker exec task-platform-postgres pg_isready -U postgres >/dev/null 2>&1 && break; \
		if [ $$i -eq 10 ]; then echo "PostgreSQL failed to become ready"; exit 1; fi; \
		sleep 2; \
	done

db-create: postgres
	@echo "Ensuring database task_platform exists..."
	@docker exec task-platform-postgres psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname='task_platform'" -t | grep -q 1 || \
		docker exec task-platform-postgres psql -U postgres -c "CREATE DATABASE task_platform"

db-drop: postgres
	@echo "Dropping database task_platform..."
	@docker exec task-platform-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'task_platform' AND pid <> pg_backend_pid();" 2>/dev/null || true
	@docker exec task-platform-postgres psql -U postgres -c "DROP DATABASE IF EXISTS task_platform"
	@echo "Database task_platform dropped."

db-migrate:
	cd backend && npm run db:migrate

db-seed:
	cd backend && npm run db:seed

setup-backend: db-create
	@if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env && echo "Created backend/.env"; fi
	cd backend && npm install
	$(MAKE) db-migrate
	$(MAKE) db-seed
	@echo "Backend setup complete."

run-backend:
	cd backend && npm run dev

setup-frontend:
	@if [ ! -f frontend/.env ]; then cp frontend/.env.example frontend/.env && echo "Created frontend/.env"; fi
	cd frontend && npm install
	@echo "Frontend setup complete."

run-frontend:
	cd frontend && npm run dev

setup: setup-backend setup-frontend
	@echo "Full setup complete. Use 'make run-backend' and 'make run-frontend' (in separate terminals) to start."

test: test-backend test-frontend
	@echo "All test targets completed."

test-backend:
	cd backend && npx jest --runInBand --forceExit --watchman=false

test-frontend:
	cd frontend && npm run test --if-present
