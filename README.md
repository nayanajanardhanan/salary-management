# PayScope — Salary Management System

PayScope is a full-stack, web-based employee salary management application. It gives an HR Manager a single, authenticated place to manage employee and salary records and to analyze compensation across departments and countries, replacing spreadsheet-based salary tracking. It is designed for an organization on the order of **10,000 employees**.

## Overview

PayScope has two parts:

* A **FastAPI backend** that exposes a REST API, enforces validation and business rules, and is the only component that talks to the database.
* A **React + TypeScript frontend** (built with Vite) that HR staff use to sign in, browse and manage employees and salaries, and view analytics.

All employee and salary data is only reachable after signing in — there are no unauthenticated data endpoints.

## Main Features

* **Authentication**: username/email + password login, issuing a JWT access token required by every employee/salary/analytics endpoint.
* **Employee management**: create, view, update, and delete employee records (name, department, country, job title, employment status).
* **Salary management**: create, view, update, and delete an employee's salary (amount + currency). Each employee has **at most one active salary record**, enforced by a database-level uniqueness constraint — salary history/versioning is intentionally not part of this system.
* **Search, filtering, sorting, pagination**: search employees by name/employee code, filter by department, country, and salary range, sort by any supported field, and browse results page by page — all performed server-side so the full dataset is never sent to the browser at once.
* **Salary analytics**: overall and department-/country-grouped salary statistics (count, average, minimum, maximum), computed per currency.
* **Validation and error handling**: consistent request validation (required fields, non-negative amounts, a supported-currency allowlist) and a consistent JSON error shape for every failure case.

## Technology Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI (Python) |
| ORM | SQLAlchemy 2.x |
| Migrations | Alembic |
| Request/response validation | Pydantic v2 |
| Database | SQLite by default (local dev/tests); PostgreSQL supported via configuration |
| Authentication | JWT (PyJWT), bcrypt password hashing |
| Backend testing | Pytest, HTTPX |
| Frontend framework | React 19 + TypeScript, built with Vite |
| Frontend routing | React Router |
| Frontend testing | Vitest, React Testing Library |

## Repository Structure

```
salary-management/
├── README.md              # This file
├── docs/
│   ├── requirements.md    # Product requirements
│   └── architecture.md    # Technical architecture
├── backend/                # FastAPI application (see backend/README.md)
│   ├── app/
│   │   ├── api/            # Route modules (v1/routes/, plus an unversioned health route)
│   │   ├── core/           # Settings, currency allowlist, error handling
│   │   ├── data_generation/# Sample employee/salary data generator
│   │   ├── db/              # Engine/session setup
│   │   ├── models/          # SQLAlchemy models (Employee, Salary, HrUser)
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── scripts/         # Seed script
│   │   ├── services/        # Business logic
│   │   └── utils/           # Pagination/sorting helpers
│   ├── alembic/             # Database migrations
│   └── tests/                # Backend test suite
└── frontend/                # React + TypeScript SPA (see frontend/README.md)
    ├── src/
    │   ├── api/              # Shared fetch client + resource-specific API calls
    │   ├── auth/              # Auth state/token storage
    │   ├── components/        # Reusable and domain components
    │   ├── hooks/              # Data-fetching and mutation hooks
    │   ├── pages/               # Routed top-level views
    │   └── types/                # Shared TypeScript types
    └── tests/                    # Cross-cutting frontend tests
```

## Prerequisites

* Python 3.11+
* Node.js 20+
* No database server is required to get started — SQLite is used by default.

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -e ".[dev]"
copy .env.example .env        # Windows
# cp .env.example .env          # macOS/Linux

alembic upgrade head          # create the database schema
python -m app.scripts.seed    # optional: sample employees/salaries + a dev HR login
```

See [`backend/README.md`](./backend/README.md) for full details.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if the backend isn't on localhost:8000
```

See [`frontend/README.md`](./frontend/README.md) for full details.

## Environment Variables

**Backend** (`backend/.env`, see [`backend/.env.example`](./backend/.env.example)):

| Variable | Purpose | Default |
|---|---|---|
| `PAYSCOPE_APP_NAME` | Application name shown in the API title. | `PayScope API` |
| `PAYSCOPE_ENVIRONMENT` | Environment label. | `development` |
| `PAYSCOPE_DEBUG` | Debug flag. | `true` |
| `PAYSCOPE_DATABASE_URL` | SQLAlchemy connection URL. | `sqlite:///./payscope.db` |
| `PAYSCOPE_JWT_SECRET_KEY` | Signs/verifies access tokens. Unset means login and token validation always fail (fails closed). | unset |
| `PAYSCOPE_JWT_ALGORITHM` | JWT signing algorithm. | `HS256` |
| `PAYSCOPE_JWT_EXPIRE_MINUTES` | Access token lifetime, in minutes. | `60` |
| `PAYSCOPE_HR_SEED_USERNAME` / `PAYSCOPE_HR_SEED_EMAIL` / `PAYSCOPE_HR_SEED_PASSWORD` | Credentials for the development HR user created by the seed script. HR-user seeding is skipped if the password is unset. | `hr.admin` / `hr.admin@payscope.local` / unset |
| `PAYSCOPE_CORS_ORIGINS` | Comma-separated list of allowed browser origins. | Vite dev server origins (`http://localhost:5173`, `http://127.0.0.1:5173`) |

**Frontend** (`frontend/.env`, see [`frontend/.env.example`](./frontend/.env.example)):

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API (no `/api/v1` suffix). | `http://localhost:8000` |

## Database Migrations

```bash
cd backend
alembic upgrade head
```

Run this after a fresh `.env` setup and before starting the app or seeding data. See [`backend/README.md`](./backend/README.md#database-migrations-alembic) for the full migration workflow.

## Seed Data

```bash
cd backend
python -m app.scripts.seed                    # 100 employees (default)
python -m app.scripts.seed --count 10000       # 10,000 employees, for scale testing
python -m app.scripts.seed --count 10000 --seed 42   # deterministic 10,000-employee dataset
python -m app.scripts.seed --reset --count 500       # clear existing data first (local/dev only)
```

The default employee count is **100**, not 10,000 — pass `--count 10000` explicitly to generate the full target-scale dataset. Each generated employee receives exactly one matching salary record. Running the command again without `--reset` refuses to run if employees already exist, so it will not silently create duplicates. See [`backend/app/scripts/README.md`](./backend/app/scripts/README.md) for full options and behavior.

## Authentication Setup

The seed script also creates one development HR user (from `PAYSCOPE_HR_SEED_USERNAME`/`PAYSCOPE_HR_SEED_EMAIL`/`PAYSCOPE_HR_SEED_PASSWORD`). Sign in with it to obtain a JWT access token:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username_or_email": "hr.admin", "password": "<your PAYSCOPE_HR_SEED_PASSWORD>"}'
```

See [`backend/README.md`](./backend/README.md#authentication) for the full authentication flow, and [`frontend/README.md`](./frontend/README.md#authentication) for the sign-in/sign-out flow through the UI.

## Running the Backend

```bash
cd backend
uvicorn app.main:app --reload
```

Check `GET http://127.0.0.1:8000/health` to confirm it started. Interactive API documentation (Swagger UI) is available at `http://127.0.0.1:8000/docs` while the backend is running.

## Running the Frontend

```bash
cd frontend
npm run dev
```

Opens at `http://localhost:5173` by default. An unauthenticated visit to any page redirects to `/login`.

## Running Tests

```bash
cd backend && pytest                # backend test suite (PostgreSQL and ~10k-scale tests are opt-in, see backend/README.md)
cd frontend && npm test              # frontend test suite
```

## Building the Frontend

```bash
cd frontend
npm run build     # type-checks (tsc -b) and builds a production bundle into dist/
```

## API Documentation

FastAPI serves interactive API documentation automatically while the backend is running:

* Swagger UI: `http://127.0.0.1:8000/docs`
* OpenAPI schema: `http://127.0.0.1:8000/openapi.json`

## Known Limitations

* **Not deployed.** This application has not been deployed anywhere; it has only been run and tested locally.
* **No containerization.** No Dockerfile or docker-compose configuration exists in this repository.
* **No CI configuration.** There is no automated CI pipeline configured in this repository; tests are run locally.
* **Minimal production logging.** Server-side error logging exists (see `docs/architecture.md`), but there is no application-wide logging configuration (format, level, aggregation) suited to a production deployment.
* **Salary history is intentionally out of scope.** Each employee has exactly one active salary record; changing it overwrites the previous value rather than versioning it (see `docs/requirements.md` Section 6).
* **No cross-currency reporting.** Salary analytics are computed per currency; there is no currency conversion or unified reporting currency.

## License

This project is created for educational and development purposes.
