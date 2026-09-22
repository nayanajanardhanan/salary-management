# PayScope — Staging Verification Runbook

This is the operator's guide to verifying PayScope in a **staging**
environment: a machine with Docker actually available. It exists because
the environment this repository has been developed and audited in so far
has never had Docker, a browser (or browser automation tool), or access to
trigger this repository's remote CI — so none of those three things have
ever been executed, only prepared. This document, together with
[`scripts/verify-staging.sh`](../scripts/verify-staging.sh), is that
preparation: everything a future operator needs to actually run those
checks, without reverse-engineering the project's commands from scratch.

**Nothing in this document claims that Docker, browser, or CI verification
has been performed.** Where a claim like that would normally go, this
document instead says exactly what to run and what a passing result looks
like, for someone to execute for real.

---

## 1. Result States

Every check in this document and in `scripts/verify-staging.sh` is one of
exactly four states. Use these consistently — don't invent a fifth, and
don't collapse them into just "worked"/"didn't work":

| State | Meaning |
|---|---|
| **PASS** | The check was actually executed, and it succeeded. |
| **FAIL** | The check was actually executed, and it did not succeed. |
| **BLOCKED** | The check could not be executed because a prerequisite is missing (Docker, Compose, the daemon, a browser, CI access, or a required earlier step that itself failed). |
| **NOT RUN** | The check was deliberately not attempted — either by explicit operator choice (e.g. `STAGING_SKIP_SEED=1`), or because it's documented as manual-only and this script doesn't cover it (browser UI, remote CI). |

---

## 2. What's Covered, and By What

| Area | How it's verified | By what |
|---|---|---|
| Docker image builds, container startup, DB readiness, migrations, seed data, backend API behavior, CORS, basic frontend-container HTTP serving | Automated | `scripts/verify-staging.sh` |
| Backend test suite (unit/integration/API/auth/DB-constraint/scale) | Manual command, documented here | Section 6 |
| Frontend test suite, lint, typecheck, production build | Manual command, documented here | Section 6 |
| Actual browser-based UI interaction (clicking, typing, visual layout, console errors) | Manual, checklist-driven | Section 7 |
| Remote CI execution (`.github/workflows/ci.yml` actually running on GitHub Actions) | Manual, process-driven | Section 8 |

---

## 3. Prerequisites

| Requirement | Notes |
|---|---|
| Docker Engine | No specific minimum version is pinned by this repository; anything recent enough to support Compose v2 (`docker compose`) is expected. The script also accepts a standalone `docker-compose` v1 binary as a fallback. |
| Docker Compose | v2 plugin (`docker compose ...`) preferred; a compatible `docker-compose` works too. |
| Bash | The script is a Bash script — run it from Git Bash, WSL, macOS, or Linux. See Section 5 for the Windows/PowerShell equivalents if you'd rather not use Bash. |
| `curl` | Used by the script for every HTTP check. |
| `openssl` (optional) | Used to generate throwaway staging secrets if present; the script falls back to Python or `/dev/urandom` if not. |
| Python 3.11+ (only for non-containerized local checks — Section 6) | See `backend/README.md`. Not needed for the containerized staging path itself. |
| Node.js 20+ (only for non-containerized local checks — Section 6) | See `frontend/README.md`. Not needed for the containerized staging path itself. |
| A real browser, or a browser automation tool | Required only for Section 7. Neither has been available in any environment used for this project so far. |

## 4. Required Environment Variables

`scripts/verify-staging.sh` **generates its own throwaway staging
credentials at run time** by default (random PostgreSQL password and JWT
signing secret) and writes them to a temp file deleted on exit — it never
reads or requires the repository's own `.env`/`backend/.env`/`frontend/.env`
files. All of the following are optional overrides; the script works with
none of them set:

| Variable | Default | Purpose |
|---|---|---|
| `STAGING_BACKEND_PORT` | `18000` | Host port for the backend (deliberately non-default, so this never collides with a developer's already-running dev server on `8000`). |
| `STAGING_FRONTEND_PORT` | `18080` | Host port for the frontend (same reasoning, vs. the default `5173`). |
| `STAGING_SEED_COUNT` | `25` | Size of the seeded test dataset (Section 5 of `docs/deployment.md`'s seed documentation — this is a small, documented default, not the ~10,000-employee scale dataset). |
| `STAGING_SKIP_SEED` | unset | Set to `1` to skip bulk employee/salary seeding entirely (reported as **NOT RUN**, an explicit opt-out, not a silent skip). The HR login user is still ensured either way, so authentication can always be tested. |
| `STAGING_HR_USERNAME` | `staging.verify` | Test login username. |
| `STAGING_HR_EMAIL` | `staging.verify@example.test` | Test login email. |
| `STAGING_HR_PASSWORD` | randomly generated | **Test credentials supplied through the environment** — set this yourself if you want a known password to log in with manually afterward (e.g. for Section 7's browser checklist); otherwise one is generated and never printed to the terminal. |
| `STAGING_KEEP_UP` | unset | Set to `1` to skip cleanup at the end, so the stack stays up for manual browser testing. |

If you run the manual `docker compose` commands yourself instead of the
script, use your own throwaway values in a scratch `.env` file — never real
credentials, and never the values from a real `.env` you have lying
around. Never use production database credentials, JWT secrets, or CI
secrets for staging verification.

---

## 5. Running the Automated Portion

```bash
cd salary-management
./scripts/verify-staging.sh
```

On Windows without Git Bash/WSL, the equivalent manual steps in
PowerShell are (this repeats what the script automates — a dedicated
PowerShell script was not added, since one Bash script covering both
Git-Bash-on-Windows and Linux/macOS is simpler to maintain than two
scripts that could drift apart):

```powershell
# 1. Generate throwaway staging values yourself (PowerShell has no
#    built-in equivalent this script relies on — pick your own random
#    strings, or use: [System.Web.Security.Membership]::GeneratePassword(32,0)
$env:POSTGRES_PASSWORD = "<your own throwaway value>"
$env:PAYSCOPE_JWT_SECRET_KEY = "<your own throwaway value>"
$env:PAYSCOPE_HR_SEED_USERNAME = "staging.verify"
$env:PAYSCOPE_HR_SEED_EMAIL = "staging.verify@example.test"
$env:PAYSCOPE_HR_SEED_PASSWORD = "<your own throwaway value>"
$env:BACKEND_PORT = "18000"
$env:FRONTEND_PORT = "18080"
$env:VITE_API_BASE_URL = "http://localhost:18000"

# 2. Build and start, under an isolated project name
docker compose -p payscope-staging-verify up -d --build

# 3. Wait for readiness yourself (poll, don't just sleep a fixed amount)
do { Start-Sleep -Seconds 3 } until ((Invoke-WebRequest "http://localhost:18000/health/ready" -UseBasicParsing -ErrorAction SilentlyContinue).StatusCode -eq 200)

# 4. Migrate, then optionally seed
docker compose -p payscope-staging-verify run --rm backend alembic upgrade head
docker compose -p payscope-staging-verify run --rm backend python -m app.scripts.seed --count 25 --seed 7

# 5. Spot-check
Invoke-RestMethod "http://localhost:18000/health"
Invoke-RestMethod "http://localhost:18000/health/ready"
$login = Invoke-RestMethod -Method Post "http://localhost:18000/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body (@{username_or_email="staging.verify"; password=$env:PAYSCOPE_HR_SEED_PASSWORD} | ConvertTo-Json)
Invoke-RestMethod "http://localhost:18000/api/v1/employees" -Headers @{Authorization="Bearer $($login.access_token)"}

# 6. Clean up
docker compose -p payscope-staging-verify down -v
```

### What the script does, in order

(Matching `docs/deployment.md`'s documented commands exactly — see that
file for the narrative walkthrough of each one.)

1. Checks `docker`, `docker compose`, and that the daemon is reachable
   (`docker info`). **Reports `BLOCKED` and stops immediately** for every
   downstream check if any of these fail.
2. Generates isolated staging credentials (or uses your
   `STAGING_HR_*`/env overrides) and non-default ports.
3. `docker compose -p payscope-staging-verify --env-file <generated> up -d --build`
4. **Polls** `GET /health/ready` (the app's own DB-connectivity check)
   every 3 seconds until it returns `200`, up to 90 seconds — no fixed
   `sleep N` standing in for an actual readiness check.
5. `docker compose ... run --rm backend alembic upgrade head`
6. Seeds data — the small, documented default (`STAGING_SEED_COUNT=25`)
   unless `STAGING_SKIP_SEED=1` was explicitly set, in which case bulk
   seeding is reported **NOT RUN** and only the HR login user is ensured.
   If data already exists from a previous kept-up run, the seed script's
   own idempotency guard correctly refuses to duplicate it — the script
   reports this as **PASS**, not FAIL, since that's the seed script
   behaving exactly as documented (see `backend/app/scripts/README.md`),
   not a defect. Bulk destructive reseeding (`--reset`) is never used by
   this script.
7. Runs backend API checks: `/health`, `/health/ready`, invalid login
   (401), unauthenticated access (401), valid login (using the configured
   test credentials) + token, authenticated
   listing/search/filter/sort/pagination/analytics, employee creation,
   employee details, salary creation, **duplicate salary rejection (409 —
   the one-active-salary-per-employee rule)**, invalid currency (422),
   negative amount (422), salary update, salary deletion, employee
   deletion, 404-after-delete checks, and a CORS preflight check from both
   an allowed and a disallowed origin.
8. Checks the frontend container serves its HTML shell over HTTP
   (`curl` only — explicitly **not** a substitute for Section 7's browser
   checklist, and both the script's output and this document say so).
9. Reports the browser checklist and remote CI as **NOT RUN** (not
   attempted by this script, by design — see Sections 7–8).
10. Prints a PASS/FAIL/BLOCKED/NOT RUN summary table, then cleans up
    (Section 3's cleanup requirements).

**Exit codes**: `0` = every executed check passed (no FAILs). `1` = at
least one check FAILed. `2` = blocked before checks could run.

If a check fails, the script points at a log file under a temp directory
(compose build/up output, migration output, seed output, or the last HTTP
response body) rather than dumping everything to the terminal.

### Safety notes

- Runs under an isolated Compose project name (`payscope-staging-verify`)
  and its own database volume — never the same project/volume a normal
  `docker compose up` would use, and never `backend/payscope.db`.
- Cleans up (`down -v`, deleting the throwaway volume) on exit by default,
  via a trap that fires on success, failure, or interruption. Set
  `STAGING_KEEP_UP=1` to opt out (e.g. for manual browser follow-up) — the
  script prints exactly how to tear it down yourself when you do.
- Never uses `--reset` (the seed script's destructive flag) automatically.
- Never prints a generated or supplied secret to the terminal, and
  explicitly checks `docker compose logs` output for each generated secret
  value, reporting a `FAIL` if one leaked.

---

## 6. Running the Existing Test Suites

These are unchanged, existing project commands (see `backend/README.md`
and `frontend/README.md`) — not new commands, and not modified by this
runbook. Run them directly on the host; they don't require the staging
Docker stack above (the backend suite uses an in-memory SQLite session by
default).

```bash
# Backend — from backend/, with the project's virtualenv active
pytest                 # default suite (unit, API, auth, model/DB constraints)
pytest -m scale        # opt-in ~10,000-employee scale suite
pytest -m postgres     # opt-in, requires PAYSCOPE_TEST_DATABASE_URL pointing at a real PostgreSQL instance

# Frontend — from frontend/
npm run lint
npx tsc -b
npm test               # this is `vitest run`, not the interactive watch mode
npm run build
```

See `docs/ci.md` for exactly how these map to CI jobs.

---

## 7. Browser-Based Verification Checklist (Manual)

**This has not been executed as part of any work on this repository so
far** — no browser or browser automation tool has been available in any
environment used. Run this checklist yourself, in a real browser, against
the staging stack (left running via `STAGING_KEEP_UP=1`, or started
manually per `docs/deployment.md`).

Sign in with the test HR user (`STAGING_HR_USERNAME`/`STAGING_HR_EMAIL`,
default `staging.verify`/`staging.verify@example.test`). Set
`STAGING_HR_PASSWORD` yourself before running the script if you want a
known password to type in by hand — otherwise re-run with
`STAGING_KEEP_UP=1` and read the generated env file path the script prints
for the value.

For each item, record **PASS**, **FAIL** (with what broke), or **NOT RUN**
(if you skip an item). Do not record PASS without having actually clicked
through it.

1. [ ] Login with valid credentials succeeds and lands on the app.
2. [ ] Login with invalid credentials shows a clear error, no console error.
3. [ ] Employee listing loads and shows the seeded employees.
4. [ ] Search returns the expected subset.
5. [ ] Department and country filters each narrow the list correctly.
6. [ ] Salary-range filter narrows correctly and is scoped to one currency.
7. [ ] Sorting (at least one field, both directions) changes row order correctly.
8. [ ] Pagination moves between pages and reflects the total count.
9. [ ] Opening an employee's details page shows their info and salary together.
10. [ ] Creating an employee succeeds, shows success feedback, and the new employee is visible in the list.
11. [ ] Creating a salary for an employee without one succeeds.
12. [ ] Updating an existing salary succeeds and the new value displays correctly.
13. [ ] Deleting a salary requires confirmation, and removes it after confirming.
14. [ ] Analytics dashboard loads and shows real (non-placeholder) numbers matching the seeded data.
15. [ ] Logout clears the session and returns to the login page.
16. [ ] After logout, visiting a protected URL directly redirects to `/login` rather than showing stale content.

Also check, throughout the above:

- **Browser console**: no uncaught errors during any of the above steps.
- **Network tab**: no failed requests (check the actual response, not just
  that a request was sent) and no request going to the wrong host —
  compare against the backend URL the frontend was actually built with;
  `docs/deployment.md`'s note on `VITE_API_BASE_URL` being fixed at
  image-build time is the thing most likely to silently misconfigure this.
- **Loading states**: a visible loading indicator appears during slower
  requests, not a blank screen.
- **Error states**: a deliberately triggered failure (e.g. wrong password,
  or stopping the backend mid-session) shows a readable error, not a blank
  page or raw technical detail.
- **Session expiry**: if practical to test (e.g. by clearing the stored
  token in dev tools, or setting a short `PAYSCOPE_JWT_EXPIRE_MINUTES` for
  this purpose), confirm the app detects the resulting `401` and returns
  to `/login` with a session-expired message.
- **Responsive layout — desktop width** (~1280px+): tables, forms, and
  navigation render as expected.
- **Responsive layout — mobile width** (~375px, e.g. via browser dev
  tools' device toolbar): specifically check whether the employee table
  overflows horizontally in a usable way (scrollable, not clipped or
  unreadable), and whether forms/buttons remain usable rather than
  overlapping or cut off. Source inspection
  (`frontend/src/index.css`) has already established there are no
  dedicated width breakpoints beyond incidental flex-wrap/scroll behavior
  — this is where that gets confirmed (or contradicted) against the real
  rendered page, not just the source.

---

## 8. CI Execution Process (Manual)

**Remote CI has not been triggered or executed as part of any work on this
repository.** `.github/workflows/ci.yml` has been authored and every
command in it has been run manually outside CI, but the workflow itself
has never run on GitHub Actions' actual infrastructure.

### Required repository permissions

- Write access to this repository (or a fork with Actions enabled), to
  push a branch or open a pull request that triggers the workflow.
- No repository *secrets* need to be configured — see `docs/ci.md`: the
  workflow needs none.

### How to trigger it

Per `.github/workflows/ci.yml`'s `on:` block, any of:

- Push a commit to `main` or `develop`.
- Open or update a pull request targeting `main` or `develop`.
- Manually run it via the GitHub Actions UI ("Run workflow" —
  `workflow_dispatch`), from the Actions tab for this repository.

### Checks that run automatically once triggered

Per `docs/ci.md` (unchanged by this task):

1. **`backend`** — default test suite, the ~10,000-employee scale suite,
   `alembic upgrade head`, `alembic check`.
2. **`backend-postgres`** — provisions a `postgres:16-alpine` service
   container with CI-only credentials, applies migrations, runs the
   opt-in PostgreSQL integration test.
3. **`frontend`** — lint, `tsc -b`, test suite, production build.
4. **`docker-build`** — builds both Docker images and runs
   `docker compose config` with placeholder values; no push, no deploy.

### Checks that require Docker or browser automation, and are NOT covered by CI

- CI's `docker-build` job builds the images and validates the Compose
  file's syntax/structure — it does **not** run `docker compose up`, so
  container *startup* is not exercised by CI at all. That gap is exactly
  what `scripts/verify-staging.sh` (Section 5) is for.
- No browser or browser automation step exists in CI. Section 7's checklist
  remains manual regardless of what CI does.

### How to inspect a failed job

- Open the failed workflow run in the Actions tab, expand the failed job
  and the specific failed step — GitHub Actions shows full command output
  inline.
- Cross-reference the failing step's name against `docs/ci.md`'s table of
  "local equivalent" commands (Section 6 above lists the same commands) to
  reproduce it on your own machine.
- Confirm the failure is real, not a masked skip: check that no step shows
  "skipped" where a real check was expected, and that the job's overall
  conclusion is `failure`, not `success` with an ignored step — this
  workflow has no `continue-on-error` anywhere (see `docs/ci.md`).

### Recording the result

When you do run this for real, record at minimum:

- The workflow run URL (`https://github.com/<org>/<repo>/actions/runs/<id>`).
- The commit SHA it ran against (shown on the run page, and via
  `git rev-parse HEAD` locally at the time you pushed/triggered it).
- Each job's conclusion (success/failure) and, for any failure, which step
  and a link to its log.

Replace this paragraph with the real run's details once you've actually
triggered it — don't leave a placeholder that looks like evidence.

---

## 9. Cleanup

- **Automated stack** (Section 5): cleaned up automatically by
  `scripts/verify-staging.sh` on exit, unless `STAGING_KEEP_UP=1` was set
  — in which case, tear it down yourself with the command the script
  prints (`docker compose -p payscope-staging-verify --env-file <path> down -v`).
- **Manual/PowerShell steps** (Section 5): `docker compose -p payscope-staging-verify down -v`.
- Both remove the isolated project's containers *and* its throwaway
  database volume — this data was never meant to persist. Neither touches
  `backend/payscope.db` or any other Compose project.

## 10. Known Limitations

- No browser or browser automation tool has been available in any
  environment used for this project so far — Section 7 remains entirely
  manual and unexecuted.
- Remote CI has never actually run on GitHub Actions' infrastructure for
  this repository — Section 8 remains a documented process, not a
  performed one.
- `scripts/verify-staging.sh` itself has only been validated for its
  prerequisite-detection logic (confirmed `BLOCKED` reporting when Docker
  is absent, and when the daemon is unreachable) and its pure helper
  functions (JSON field extraction, secret generation) — the full
  build/start/migrate/seed/API-check flow requires Docker to execute and
  has not been run end-to-end anywhere yet. Treat the first real run as
  the actual first test of that flow, not a formality.
- Every functional limitation already documented in
  `docs/architecture.md` Section 11.4 and `docs/deployment.md`'s "Known
  Limitations" (salary history/cross-currency reporting intentionally
  excluded, no server-side JWT revocation, no dedicated search index, no
  frontend responsive breakpoints, single-instance-only container setup,
  no TLS) still applies — staging verification does not change the
  application's functional scope.

---

## 11. Summary Table

| Item | Automated by `scripts/verify-staging.sh`? | Executed as part of any task so far? |
|---|---|---|
| Docker/Compose/daemon prerequisite detection | Yes | Yes — confirmed correctly reports `BLOCKED` for both "Docker missing" and "daemon unreachable" (see the introducing commit's verification report) |
| Image build, container startup, DB readiness (polled) | Yes | **No** — requires Docker, unavailable in every environment used so far |
| Migrations, seed data (with explicit skip option) | Yes | **No** — same reason |
| Backend API checks (auth, CRUD, validation, CORS, analytics) | Yes | **No** — same reason |
| Frontend container serves HTTP | Yes (HTTP-level only) | **No** — same reason |
| Backend/frontend test suites, lint, typecheck, build (Section 6) | No — documented commands only | Previously run directly on the host in earlier work on this repository (see prior verification reports); not re-run as part of *this* task |
| Browser-based UI checklist (Section 7) | No — manual | **No** — no browser/automation tool available |
| Remote CI execution (Section 8) | No — manual, requires push access | **No** — pushing to remote is out of scope for this repository's current working process |

If you are the operator picking this up next: run `scripts/verify-staging.sh`
first, then work through Section 7 with a real browser against the same
stack (`STAGING_KEEP_UP=1`), then follow Section 8 when you're ready to
push. Update this table's "Executed" column with real results as you go.
