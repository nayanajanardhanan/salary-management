# PayScope Backend

FastAPI backend for PayScope. See [`docs/architecture.md`](../docs/architecture.md)
for the full technical architecture, including the complete endpoint list.

This service exposes a JWT-authenticated REST API (`/api/v1/...`) for
employee CRUD, salary CRUD (one active salary per employee, DB-enforced),
and salary analytics, backed by SQLAlchemy models and Alembic migrations.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -e ".[dev]"
copy .env.example .env        # Windows
# cp .env.example .env          # macOS/Linux

alembic upgrade head          # create the database schema (see Database migrations below)
python -m app.scripts.seed    # optional: sample employees/salaries + a dev HR login (see Authentication below)
```

## Run the app

```bash
uvicorn app.main:app --reload
```

Then check `GET http://127.0.0.1:8000/health`.

## Authentication

`/api/v1/*` endpoints (employee, salary, and salary-analytics data) require
an `Authorization: Bearer <access token>` header. The token comes from
logging in — there is no manual/static token to configure or paste anymore.

1. Apply migrations and seed a development HR user (see
   [Database migrations](#database-migrations-alembic) and
   [Seeding an HR user](#seeding-an-hr-user) below).
2. `POST /api/v1/auth/login` with that user's username (or email) and
   password:

   ```bash
   curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username_or_email": "hr.admin", "password": "<your PAYSCOPE_HR_SEED_PASSWORD>"}'
   ```

   Returns `{"access_token": "...", "token_type": "bearer", "expires_in": 3600}`
   on success, or a `401` (`code="INVALID_CREDENTIALS"`) for an unknown
   username/email, a wrong password, or an inactive user — all three look
   identical to the caller, by design.
3. Send that `access_token` as `Authorization: Bearer <access_token>` on
   subsequent requests. Tokens are JWTs signed with `PAYSCOPE_JWT_SECRET_KEY`
   and expire after `PAYSCOPE_JWT_EXPIRE_MINUTES` (default 60); a missing,
   malformed, invalid, or expired token is rejected identically with a
   `401`.

There is no logout endpoint: tokens are stateless JWTs with no server-side
session to revoke, so "logging out" just means the client stops sending the
token (the frontend clears it from storage — see
[`frontend/README.md`](../frontend/README.md#authentication)). A token
already issued stays valid until it expires, even after the client
discards it.

For the frontend login/logout walkthrough (the actual UI most people will
use, rather than `curl`), see
[`frontend/README.md`](../frontend/README.md#authentication).

| Variable | Purpose | Default |
|---|---|---|
| `PAYSCOPE_JWT_SECRET_KEY` | Signs/verifies access tokens. Unset means login always fails and no token can be validated (fails closed). | unset |
| `PAYSCOPE_JWT_ALGORITHM` | JWT signing algorithm. | `HS256` |
| `PAYSCOPE_JWT_EXPIRE_MINUTES` | Access token lifetime, in minutes. | `60` |

Set `PAYSCOPE_JWT_SECRET_KEY` to a long, random value per environment —
never commit a real secret (see `.env.example`).

### Seeding an HR user

`python -m app.scripts.seed` (see [Seed script](app/scripts/README.md)) also
creates one development HR user, from these environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `PAYSCOPE_HR_SEED_USERNAME` | Seeded HR user's username. | `hr.admin` |
| `PAYSCOPE_HR_SEED_EMAIL` | Seeded HR user's email. | `hr.admin@payscope.local` |
| `PAYSCOPE_HR_SEED_PASSWORD` | Seeded HR user's password (hashed before storage). | unset — HR-user seeding is skipped if unset |

Running the seed command again never creates a duplicate HR user (it looks
up the existing user by username/email first). To change the seeded
password, either delete the `hr_users` row and re-seed, or update
`PAYSCOPE_HR_SEED_PASSWORD` and update the row directly — the seed script
itself never overwrites an existing user's password. The password is never
printed or logged, by the seed script or the login endpoint.

**Security note:** these are development-only, local defaults. Never reuse
`PAYSCOPE_HR_SEED_PASSWORD` or `PAYSCOPE_JWT_SECRET_KEY` in a real
deployment, and never commit real values for either — `.env` is gitignored;
only `.env.example` (with placeholder values) is committed.

## Run tests

```bash
pytest
```

PostgreSQL integration tests and the ~10k-employee scale test are opt-in
and excluded from the default run (see below).

## Database configuration

The database connection URL is read from the `PAYSCOPE_DATABASE_URL`
environment variable (see `app/core/config.py`); it is never hardcoded.

| Variable | Purpose | Default |
|---|---|---|
| `PAYSCOPE_DATABASE_URL` | SQLAlchemy connection URL | `sqlite:///./payscope.db` |

* Local development and the default test run use SQLite, so no database
  server needs to be provisioned to get started.
* For PostgreSQL (e.g. production, or to verify Postgres-specific behavior),
  set `PAYSCOPE_DATABASE_URL` to a `postgresql+psycopg://...` URL in `.env`.

Reusable database building blocks live under `app/db/`:

* `app/db/session.py` — `create_db_engine()` (engine factory), the shared
  `engine`/`SessionLocal`, and `get_db()`, a FastAPI dependency that yields a
  request-scoped session and closes it afterward.
* `app/db/base.py` — the shared SQLAlchemy declarative `Base` that future
  models will inherit from.

### PostgreSQL integration test

`tests/db/test_postgres_integration.py` is marked `postgres` and skipped by
default (see the `addopts` in `pyproject.toml`). To run it against a real
PostgreSQL instance:

```bash
PAYSCOPE_TEST_DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/payscope_test pytest -m postgres
```

### Scale test (~10,000 employees)

`tests/scale/test_scale_10k.py` verifies listing, search, filtering,
pagination, and analytics stay functionally correct at the target scale of
NFR 4.2/Acceptance Criterion 8.9. It generates and inserts ~10,000
employee/salary records (via the same `app.data_generation` dataset
generator and `app.scripts.seed.seed_database` helper used elsewhere), so
it's marked `scale` and skipped by default. Run it explicitly with:

```bash
pytest -m scale
```

## Database migrations (Alembic)

Alembic is configured under `alembic/` and sources its database URL from the
same `PAYSCOPE_DATABASE_URL` setting used by the app (see `alembic/env.py`) —
`alembic.ini` itself holds no connection details. `alembic/env.py`'s
`target_metadata` is wired to `app.db.base.Base.metadata`, so future models
are automatically picked up by autogenerate.

Common commands (run from `backend/`):

```bash
# Create a new migration after adding/changing models
alembic revision --autogenerate -m "add employee table"

# Apply all pending migrations
alembic upgrade head

# Roll back the most recent migration
alembic downgrade -1
```

Existing migrations (`alembic/versions/`), in order: `c97da150dfe4` (employee
and salary tables), `5de088d1fe56` (`hr_users` table, for HR login — see
[Authentication](#authentication)). Run `alembic upgrade head` after a fresh
`pip install -e ".[dev]"` / `.env` setup to create the database schema
before starting the app or running the seed script.
