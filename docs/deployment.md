# PayScope — Local Container Deployment

This document describes how to run PayScope's backend, frontend, and
database as containers on **your own machine**, using the `Dockerfile`s and
`docker-compose.yml` in this repository.

**This is a local containerization/deployment-preparation step, not an
external deployment.** No PayScope environment has been deployed to any
external host, cloud provider, or shared infrastructure. Running this
locally does not require, and does not perform, any such deployment.
Production secrets, a real domain/TLS, a managed database, and
infrastructure-specific configuration (a real reverse proxy, autoscaling,
backups, etc.) are still environment-specific work that this setup does not
provide — see [Known Limitations](#known-limitations) below.

> **Verification status of this document**: Docker was not available in the
> environment this setup was authored and tested in, so the container
> **build and startup steps below could not be executed or verified** here.
> The Dockerfiles and `docker-compose.yml` were written from direct
> inspection of the application's actual entry points, dependencies, and
> configuration (not assumed), and the YAML was syntax-checked, but you
> should treat "docker build" / "docker compose up" success as unverified
> until you run them yourself. Everything else in this repository not
> specific to containers (the backend and frontend test suites, lint,
> typecheck, and the frontend production build) **was** run and passed —
> see the verification report for the commit that introduced this file.

---

## Prerequisites

- Docker Engine and Docker Compose (the `docker compose` CLI plugin, or a
  compatible `docker-compose`).
- No local Python, Node.js, PostgreSQL, or SQLite installation is required
  for the containerized path — everything runs inside the containers.
- Ports `8000` (backend) and `5173` (frontend) free on your machine (or set
  `BACKEND_PORT`/`FRONTEND_PORT` — see below — to use different ones).

## Required Environment Variables

Copy the root `.env.example` to `.env` and fill in real values before
starting anything:

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` | No (has a default) | Database name/user for the `db` service. |
| `POSTGRES_PASSWORD` | **Yes** | Database password. `docker-compose.yml` refuses to start `db`/`backend` without it. |
| `PAYSCOPE_JWT_SECRET_KEY` | **Yes** | Signs/verifies JWT access tokens (see `backend/README.md#authentication`). `docker-compose.yml` refuses to start `backend` without it. |
| `PAYSCOPE_JWT_ALGORITHM` / `PAYSCOPE_JWT_EXPIRE_MINUTES` | No | JWT algorithm/token lifetime. |
| `PAYSCOPE_HR_SEED_USERNAME` / `_EMAIL` / `_PASSWORD` | No | Used only if you run the seed script's HR-user step (below). Leave `PAYSCOPE_HR_SEED_PASSWORD` blank to skip it. |
| `PAYSCOPE_CORS_ORIGINS` | No (has a default) | Browser origins allowed to call the API. The default matches `FRONTEND_PORT` below, for local use only. |
| `PAYSCOPE_LOG_LEVEL` | No | `DEBUG`/`INFO`/`WARNING`/`ERROR`/`CRITICAL`. |
| `VITE_API_BASE_URL` | No (has a default) | Baked into the frontend's static bundle at **image build time** (Vite convention — see `frontend/src/api/client.ts`); cannot be changed by restarting the container, only by rebuilding the frontend image. The default assumes the backend's port is published to this machine (see `BACKEND_PORT`). |
| `BACKEND_PORT` / `FRONTEND_PORT` | No | Host ports the services are published on (default `8000`/`5173`). |

Every value above is either environment-driven or explicitly required with
no fallback — none of these are hardcoded in `docker-compose.yml` or the
Dockerfiles. See `.env.example` for full inline documentation of each.

## Database Choice: PostgreSQL in Containers, SQLite Elsewhere

Non-containerized local development (`backend/README.md`) defaults to
SQLite for zero-setup convenience. `docs/architecture.md` has always
documented PostgreSQL as the intended **production** database, and the
backend already depends on `psycopg` and has an opt-in PostgreSQL
integration test. This containerized setup therefore runs **PostgreSQL**
as the `db` service — the same SQLAlchemy models and Alembic migrations
apply unchanged to either database (see `backend/README.md#database-configuration`).

This does not touch, replace, or read `backend/payscope.db` (the SQLite
file used by non-containerized local development) — the two setups are
entirely independent and can coexist. If you specifically want to run the
containerized backend against SQLite instead of the bundled PostgreSQL
service, you can set `PAYSCOPE_DATABASE_URL` on the `backend` service to a
`sqlite:///...` path and remove the `db` service/dependency — but be aware
of the limitation below first.

**Containerized SQLite limitation (if you choose this path yourself):** a
container's writable filesystem layer is ephemeral by default — a SQLite
database file written inside the container disappears when the container
is removed, unless you explicitly mount a volume for it (e.g.
`./data:/app` with `PAYSCOPE_DATABASE_URL=sqlite:////app/data/payscope.db`).
SQLite also does not support multiple concurrent writer processes well,
which matters if you ever scale the backend service beyond one replica.
Neither of these is a concern with the PostgreSQL setup this repository
ships by default, which is why it's the default here.

## Building the Images

```bash
docker compose build
```

Or individually:

```bash
docker build -t payscope-backend ./backend
docker build -t payscope-frontend --build-arg VITE_API_BASE_URL=http://localhost:8000 ./frontend
```

The backend image installs only the base (non-dev) dependency group —
`pytest`/`httpx` are not included; `alembic` is, since applying migrations
is a deployment-time operation (see `backend/pyproject.toml`). The frontend
image is a multi-stage build: `node:20-slim` compiles the production
bundle, and the final image is `nginx:1.27-alpine` serving only the static
output — no Node.js runtime ships in the final image.

## Starting the Application

```bash
docker compose up -d
```

This starts, in dependency order: `db` (PostgreSQL, waits until healthy),
then `backend` (waits for `db` to be healthy), then `frontend`. It does
**not** run migrations or seed data automatically — see the next two
sections. It also does not delete or reset any existing data in the
`payscope_db_data` volume; re-running `docker compose up` against an
existing volume reuses it.

## Running Migrations

Migrations are a deliberate, separate step — not run automatically on
container start, so you always know exactly when the schema changes:

```bash
docker compose run --rm backend alembic upgrade head
```

This runs `alembic upgrade head` inside a one-off `backend` container
against the same database the running `backend`/`db` services use, then
exits. Safe to re-run — Alembic tracks the applied revision and is a no-op
if the schema is already current.

## Seeding Data

```bash
# Default: 100 employees (matches the non-containerized default — see
# backend/app/scripts/README.md)
docker compose run --rm backend python -m app.scripts.seed

# The full ~10,000-employee target scale, explicitly:
docker compose run --rm backend python -m app.scripts.seed --count 10000

# Deterministic (reproducible) 10,000-employee dataset:
docker compose run --rm backend python -m app.scripts.seed --count 10000 --seed 42
```

As with non-containerized use, the seed script refuses to run if employees
already exist unless `--reset` is passed (destructive; local/dev use only
— see `backend/app/scripts/README.md`), and it is never invoked
automatically by `docker compose up`.

## Accessing the Application

- Frontend: `http://localhost:5173` (or `FRONTEND_PORT`, if overridden).
- Backend API: `http://localhost:8000` (or `BACKEND_PORT`).
- Interactive API docs: `http://localhost:8000/docs`.

Sign in with the HR user created by the seed script (see
`backend/README.md#authentication` for the full login flow).

## Health and Readiness

```bash
curl http://localhost:8000/health          # liveness: process is up
curl http://localhost:8000/health/ready    # readiness: process is up AND the database is reachable
```

`/health/ready` returns `503` (`{"error": {"code": "DATABASE_UNAVAILABLE", ...}}`)
if the database cannot be reached, without exposing the connection string
or any other database detail. `docker-compose.yml`'s `backend` service
healthcheck uses `/health/ready`; `db`'s healthcheck uses PostgreSQL's own
`pg_isready`.

## Viewing Logs

```bash
docker compose logs -f              # all services
docker compose logs -f backend      # one service
```

Backend logs are timestamped and leveled (`PAYSCOPE_LOG_LEVEL`, default
`INFO`), written to stdout — see `backend/README.md#logging`.

## Stopping the Containers

```bash
docker compose down          # stops and removes containers; keeps the payscope_db_data volume
docker compose down -v       # also deletes the database volume — destructive, deletes all seeded/created data
```

`docker compose down` (without `-v`) does not delete your data; the next
`docker compose up` reuses the same `payscope_db_data` volume.

## Known Limitations

- **Not deployed anywhere external.** This is a local-only containerized
  setup, run and (partially — see the verification note at the top of this
  document) checked on the machine it was authored on. No cloud provider,
  hosting platform, or shared infrastructure has been used.
- **CI validates that both images build, but does not run or deploy them.**
  `.github/workflows/ci.yml`'s `docker-build` job builds both Dockerfiles
  and validates `docker-compose.yml` on every push/PR — see `docs/ci.md`.
  It never runs `docker compose up`, so container *startup* (as opposed to
  just building) is still only manually verified, per the note at the top
  of this document.
- **Single instance only.** `docker-compose.yml` runs exactly one replica
  of `backend` and `frontend` — there is no load balancing, autoscaling, or
  zero-downtime deployment process.
- **No TLS/HTTPS termination.** Both services are plain HTTP inside this
  compose file; a real deployment would need a reverse proxy or platform
  feature to provide TLS.
- **No backup/restore process** for the `payscope_db_data` volume.
- **Frontend API URL is fixed at image build time.** Changing
  `VITE_API_BASE_URL` for a different target environment requires rebuilding
  the frontend image, not just changing an environment variable at
  container start (a consequence of how Vite resolves `import.meta.env.*`
  — see `frontend/src/api/client.ts`).
- **Minimal logging.** Timestamped, leveled stdout logging exists (see
  `backend/README.md#logging`), but there is no log aggregation, structured
  (JSON) logging, or retention policy — `docker compose logs` only shows
  what's currently retained by the Docker daemon's own log driver.
- Every other limitation already documented in `docs/architecture.md`
  Section 11.3 (salary history/cross-currency reporting intentionally
  excluded, no server-side JWT revocation, no dedicated search index,
  frontend has no responsive breakpoints) still applies — containerizing
  the application does not change its functional scope.

## What Is and Is Not Verified

| Aspect | Status |
|---|---|
| Backend/frontend test suites, lint, typecheck, frontend production build | Verified — run directly on the host, passing (see the commit's verification report). |
| `docker-compose.yml` YAML syntax | Verified — parsed successfully with a YAML parser. |
| `docker build` for both images actually succeeding | **Not verified** — Docker was unavailable in the authoring environment. |
| Containers actually starting, the backend reaching the database, `/health`/`/health/ready` responding, migrations applying, the frontend serving and calling the backend | **Not verified**, for the same reason. |
| Any external deployment | **Not performed.** |

If you run this yourself and hit a problem, it has not yet been exercised
end-to-end — please treat the first real run as the actual first test of
the container build/startup path, not a formality.

**When you do have Docker available**: [`scripts/staging-verify.sh`](../scripts/staging-verify.sh)
automates the build/start/migrate/seed/API-check sequence above end to end
under isolated, throwaway staging credentials, and reports each check as
PASS/FAIL/BLOCKED rather than assuming success. See
[`docs/staging-verification.md`](./staging-verification.md) for how to run
it, plus the manual browser-verification checklist and CI-execution process
that remain outside what any script can do.
