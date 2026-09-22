# PayScope — Continuous Integration

This document describes the GitHub Actions workflow at
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml): what it
validates, what triggers it, how to reproduce each check locally, and what
it intentionally does not do.

**This workflow validates code — it does not deploy anything.** It never
pushes an image to a registry, and never runs against or deploys to any
external environment. See [`docs/deployment.md`](./deployment.md) for the
separate local container setup, and its own note on what has and hasn't
been verified.

## Triggers

- `push` to `main` or `develop`.
- `pull_request` targeting `main` or `develop`.
- `workflow_dispatch` (manual run from the GitHub Actions UI).

## Jobs

### `backend` — Backend tests and migrations (SQLite)

| Step | Local equivalent |
|---|---|
| Install dependencies | `cd backend && pip install -e ".[dev]"` |
| Run the default test suite | `pytest` |
| Run the ~10,000-employee scale test suite | `pytest -m scale` |
| Apply migrations to a fresh database (schema creation check) | `alembic upgrade head` |
| Check for model/migration drift | `alembic check` |

Runs against the default local SQLite URL (`sqlite:///./payscope.db`) — a
fresh CI checkout never has an existing database file (it's gitignored and
never committed), so this exercises the same schema-creation path a
first-time setup would. `alembic check` fails the build if a model was
changed without generating a matching migration (see
`backend/README.md#database-migrations-alembic`).

**No backend linter or type-checker is run**, because none is configured in
this repository (`backend/pyproject.toml` has no `[tool.ruff]`/`[tool.mypy]`
section, and neither is a project dependency). This is an intentional
exclusion, not an oversight — see [What Is Intentionally
Excluded](#what-is-intentionally-excluded) below.

### `backend-postgres` — Backend PostgreSQL integration test

Provisions a throwaway `postgres:16-alpine` service container (CI-only
credentials: `ci_user`/`ci_password`/`payscope_ci` — not used anywhere else,
never a production or personal credential), waits for it to report healthy
(via the service's own health check, so no manual wait/poll step is
needed), then:

| Step | Local equivalent |
|---|---|
| Apply migrations to PostgreSQL | `PAYSCOPE_DATABASE_URL=postgresql+psycopg://... alembic upgrade head` |
| Run the PostgreSQL integration test | `PAYSCOPE_TEST_DATABASE_URL=postgresql+psycopg://... pytest -m postgres` |

This is the same opt-in test and workflow documented in
`backend/README.md#postgresql-integration-test` — CI runs it against a real
(if ephemeral) PostgreSQL instance rather than skipping it, since a service
container is easy to provision in GitHub Actions.

### `frontend` — Frontend lint, typecheck, tests, and build

| Step | Local equivalent |
|---|---|
| Install dependencies | `cd frontend && npm ci` |
| Lint | `npm run lint` |
| Type-check | `npx tsc -b` |
| Run the test suite | `npm test` (this is `vitest run`, not the interactive watch mode) |
| Production build | `npm run build` |

### `docker-build` — Docker image builds (validation only)

| Step | Local equivalent |
|---|---|
| Build the backend image | `docker build -t payscope-backend:ci ./backend` |
| Build the frontend image | `docker build -t payscope-frontend:ci --build-arg VITE_API_BASE_URL=http://localhost:8000 ./frontend` |
| Validate `docker-compose.yml` resolves | `POSTGRES_PASSWORD=... PAYSCOPE_JWT_SECRET_KEY=... docker compose config` |

Confirms both Dockerfiles still build and that `docker-compose.yml` is
syntactically and referentially valid (services, variable interpolation,
required values). It does **not** start any containers, run migrations or
the seed script inside a container, or exercise the running application —
see [`docs/deployment.md`](./deployment.md#what-is-and-is-not-verified) for
what remains unverified about the containerized setup itself.

## Required Repository Secrets / Environment Variables

**None.** Every value the workflow needs is either a CI-only placeholder
defined directly in `ci.yml` (the PostgreSQL service credentials, the
`docker compose config` placeholders) or requires no configuration at all
(the default SQLite backend tests, the frontend checks). No GitHub Actions
repository secret needs to be configured for this workflow to run.

## Tests Requiring PostgreSQL or Other Services

Only `tests/db/test_postgres_integration.py` (marked `postgres`) requires a
real PostgreSQL instance; it is skipped in the `backend` job (excluded via
`pyproject.toml`'s `addopts`) and run explicitly in the dedicated
`backend-postgres` job against the service container described above. No
other test requires an external service, network access, or a personal
environment variable — the default suite and the frontend suite are fully
self-contained (in-memory SQLite for the backend, mocked `fetch` for the
frontend).

## What Is Intentionally Excluded

- **No backend lint/type-check step.** No linter or type-checker (e.g.
  ruff, mypy) is configured for the backend in this repository. Adding one
  is a separate decision with its own trade-offs (rule selection, fixing
  any existing violations) and is out of scope for this CI setup, which
  only wires up what already exists.
- **No image publishing.** `docker-build` builds both images locally on the
  runner and discards them; it never logs into or pushes to any container
  registry.
- **No deployment step.** Nothing in this workflow deploys the application
  anywhere, containerized or not.
- **No security/dependency scanning.** This workflow does not run a
  vulnerability scanner, SAST tool, or dependency-audit step. If that's
  wanted later, it is a separate, explicit addition — this document will
  not claim it exists until it does.
- **No multi-version test matrix.** The workflow pins one Python version
  (3.12, matching `backend/pyproject.toml`'s `requires-python = ">=3.11"`
  and the version this repository's tests were verified against) and one
  Node.js version (20, matching `frontend/README.md`'s stated requirement)
  rather than testing a matrix of versions.

## How to Interpret a CI Failure

- **`backend` or `backend-postgres` red**: a real test failed, a migration
  failed to apply, or `alembic check` detected a model change with no
  matching migration. Reproduce with the "local equivalent" commands above
  from the `backend/` directory.
- **`frontend` red**: a lint rule, a type error, a test, or the production
  build itself failed. Reproduce from `frontend/`.
- **`docker-build` red**: one of the Dockerfiles no longer builds, or
  `docker-compose.yml` no longer resolves (e.g. a typo, or a new required
  variable that isn't documented). This does not necessarily mean the
  *application* is broken — check the other three jobs first.

A failing job fails the whole workflow run (GitHub Actions' default
behavior — no job here suppresses or ignores its own step failures); there
is no step configured to continue past a failure or to treat a warning as a
pass.
