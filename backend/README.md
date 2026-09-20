# PayScope Backend

FastAPI backend for PayScope. See [`docs/architecture.md`](../docs/architecture.md)
for the full technical architecture.

This version adds database configuration, session management, and Alembic
migration infrastructure on top of the initial scaffolding. Employee/salary
models, migrations, and APIs are added in later steps.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -e ".[dev]"
copy .env.example .env        # Windows
# cp .env.example .env          # macOS/Linux
```

## Run the app

```bash
uvicorn app.main:app --reload
```

Then check `GET http://127.0.0.1:8000/health`.

## Run tests

```bash
pytest
```

PostgreSQL integration tests are opt-in and excluded from the default run
(see below).

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

No migrations exist yet — this step only sets up the infrastructure.
