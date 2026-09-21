# PayScope — Staging Verification Runbook

This is the operator's guide to verifying PayScope in a **staging**
environment: a machine with Docker actually available. It exists because
the environment this repository has been developed and audited in so far
has never had Docker, a browser (or browser automation tool), or access to
trigger this repository's remote CI — so none of those three things have
ever been executed, only prepared. This document, together with
[`scripts/staging-verify.sh`](../scripts/staging-verify.sh), is that
preparation: everything a future operator needs to actually run those
checks, without having to reverse-engineer the project's commands from
scratch.

**Nothing in this document claims that Docker, browser, or CI verification
has been performed.** Where a claim like that would normally go, this
document instead says exactly what to run and what a passing result looks
like, for someone to execute for real.

---

## 1. What This Covers, and What It Doesn't

| Area | How it's verified | By what |
|---|---|---|
| Docker image builds, container startup, DB readiness, migrations, seed data, backend API behavior, CORS, basic frontend-container HTTP serving | Automated | `scripts/staging-verify.sh` |
| Actual browser-based UI interaction (clicking, typing, visual layout, console errors) | Manual, checklist-driven | Section 3 of this document |
| Remote CI execution (`.github/workflows/ci.yml` actually running on GitHub Actions) | Manual, process-driven | Section 4 of this document |

The script and the manual sections are deliberately separate: a script
that pretended to click through the UI without a real browser, or that
claimed to have triggered CI without push access, would violate this
project's own standing rule not to claim a check passed unless it was
actually executed. Keep that separation when extending this document.

---

## 2. Environment Requirements

| Requirement | Notes |
|---|---|
| Docker Engine | No specific minimum version is pinned by this repository; anything recent enough to support Compose v2 (`docker compose`, not the standalone `docker-compose` v1 binary) is expected. The script also accepts a `docker-compose` binary as a fallback. |
| Docker Compose | v2 plugin (`docker compose ...`) preferred; a compatible `docker-compose` works too. |
| Bash | The script is a Bash script (`#!/usr/bin/env bash`) — run it from Git Bash, WSL, macOS, or Linux. It does not require Python or Node.js on the **host** — those only run inside the containers. |
| `curl` | Used by the script for every HTTP check. Present by default on virtually every Linux/macOS/WSL/Git Bash setup. |
| `openssl` (optional) | Used to generate throwaway staging secrets if present; the script falls back to Python or `/dev/urandom` if not — see `random_hex()` in the script. |
| Python 3.11+ (only if running non-containerized local checks instead) | See `backend/README.md`; not needed for the containerized staging path. |
| Node.js 20+ (only if running non-containerized local checks instead) | See `frontend/README.md`; not needed for the containerized staging path. |
| A real browser, or a browser automation tool (e.g. Playwright, `chromium-cli`) | Required only for Section 3 (manual UI checklist). Neither has been available in any environment used for this project so far. |

### Staging-only credentials

`scripts/staging-verify.sh` **generates its own throwaway credentials at
run time** (a random PostgreSQL password, JWT signing secret, and HR-user
password — see `random_hex()` in the script) and writes them to a
temporary file that is deleted on exit. It never uses, reads, or requires
the repository's own `.env`/`backend/.env`/`frontend/.env` files, and never
prints a generated secret to the terminal or into `docker compose logs`
(the script explicitly checks for this — see Section 5 below). If you run
the manual `docker compose` commands yourself instead of the script, use
your own throwaway values in a scratch `.env` file — never real credentials,
and never the values from a real `.env` you have lying around.

### Database requirements

The script uses the `db` service already defined in `docker-compose.yml`
(PostgreSQL) under an **isolated Compose project name**
(`payscope-staging-verify`) and its own named volume, distinct from
whatever project name/volume a normal `docker compose up` would use. It
never touches `backend/payscope.db` (the SQLite file used by
non-containerized local development) or any other Compose project's
volume.

### Cleanup requirements

By default, the script removes the containers **and** the staging
database volume it created (`docker compose ... down -v`) when it exits,
success or failure, via a `trap ... EXIT`. Set `STAGING_KEEP_UP=1` to skip
this (e.g. to manually browser-test against the running stack afterward)
— the script prints exactly how to tear it down yourself when you do.

---

## 3. Running the Automated Portion

```bash
cd salary-management
./scripts/staging-verify.sh
```

What it does, in order (matching `docs/deployment.md`'s documented
commands exactly — see that file for the narrative walkthrough of each
command):

1. Checks `docker`, `docker compose`, and that the daemon is reachable
   (`docker info`). **Stops immediately and reports `BLOCKED`** for every
   downstream check if any of these fail — it does not attempt partial
   verification with a missing prerequisite.
2. Generates isolated staging credentials and ports (defaults: backend on
   `18000`, frontend on `18080` — deliberately non-default, so this never
   collides with a developer's already-running `docker compose up` or
   non-containerized `uvicorn`/`npm run dev` on the standard `8000`/`5173`
   ports).
3. `docker compose -p payscope-staging-verify --env-file <generated> up -d --build`
4. Polls `GET /health/ready` (the app's own DB-connectivity check) until it
   returns `200`, up to 90 seconds.
5. `docker compose ... run --rm backend alembic upgrade head`
6. `docker compose ... run --rm backend python -m app.scripts.seed --count 25 --seed 7`
   (a small test dataset — override with `STAGING_SEED_COUNT`, e.g. `=10000`
   for a scale run, though that changes what "small test dataset" in
   Section 3 of the original task means — the default stays small
   deliberately).
7. Runs backend API checks: `/health`, `/health/ready`, invalid login (401),
   unauthenticated access (401), valid login + token, authenticated
   listing/search/sort/pagination/analytics, employee creation, employee
   details, salary creation, **duplicate salary rejection (409 — the
   one-active-salary-per-employee rule)**, invalid currency (422), negative
   amount (422), salary update, salary deletion, employee deletion,
   404-after-delete checks, and a CORS preflight check from both an
   allowed and a disallowed origin.
8. Checks the frontend container serves its HTML shell over HTTP
   (`curl` only — explicitly **not** a substitute for Section 4's browser
   checklist, and the script says so in its own output).
9. Prints a `PASS`/`FAIL`/`BLOCKED` line per check and a final summary
   table, then cleans up (Section 2).

**Exit codes**: `0` = every executed check passed. `1` = at least one
check failed (the summary shows which). `2` = blocked before checks could
run (missing Docker/Compose/daemon).

If a check fails, the script points at a log file under a temp directory
(compose build/up output, migration output, seed output, or the last HTTP
response body) rather than dumping everything to the terminal — read that
file for the actual error.

---

## 4. Browser-Based Verification Checklist (Manual)

**This has not been executed as part of any work on this repository so
far** — no browser or browser automation tool has been available in any
environment used. Run this checklist yourself, in a real browser, against
the staging stack (either left running via `STAGING_KEEP_UP=1`, or started
manually per `docs/deployment.md`).

Sign in with the seeded HR user. If you ran `scripts/staging-verify.sh`,
its own output prints the generated username (`staging.verify`) and the
backend/frontend URLs — the password is intentionally not printed to the
terminal; re-run with `STAGING_KEEP_UP=1` and read it directly from the
script's temp env file path it prints, or seed your own known credentials
manually per `docs/deployment.md#seeding-data`.

For each item, record **Pass**, **Fail** (with what broke), or **Not
tested**. Do not mark an item Pass without having actually clicked through
it.

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
  that a request was sent) and no request going to the wrong host (compare
  against the backend URL the frontend was built with —
  `docs/deployment.md`'s note on `VITE_API_BASE_URL` being fixed at
  image-build time is the thing most likely to silently misconfigure this).
- **Loading states**: a visible loading indicator appears during slower
  requests, not a blank screen.
- **Error states**: a deliberately triggered failure (e.g. wrong password,
  or stopping the backend mid-session) shows a readable error, not a blank
  page or raw technical detail.
- **Session expiry**: if practical to test (e.g. by manually clearing the
  stored token in dev tools, or waiting out a short
  `PAYSCOPE_JWT_EXPIRE_MINUTES` set for this purpose), confirm the app
  detects the resulting `401` and returns to `/login` with a
  session-expired message, rather than silently failing requests.
- **Responsive layout**: resize the browser (or use dev tools' device
  toolbar) to a common desktop width (~1280px+) and a common mobile width
  (~375px). Check specifically: does the employee table overflow
  horizontally in a usable way (scrollable, not clipped/unreadable)? Do
  forms and buttons remain usable, not overlapping or cut off? Source
  inspection (`frontend/src/index.css`) has already established there are
  no dedicated width breakpoints beyond incidental flex-wrap/scroll
  behavior — this checklist item is where that gets confirmed (or
  contradicted) against the real rendered page, not just the source.

---

## 5. CI Execution Process (Manual)

**Remote CI has not been triggered or executed as part of any work on this
repository.** `.github/workflows/ci.yml` has been authored and every
command in it has been run manually outside CI, but the workflow itself
has never run on GitHub Actions' actual infrastructure. This section is
the process for someone with the right repository access to actually do
that — not a claim that it's been done.

### Required repository permissions

- Write access to this repository (or a fork with Actions enabled), to
  push a branch or open a pull request that triggers the workflow.
- No repository *secrets* need to be configured — see `docs/ci.md`'s
  "Required Repository Secrets / Environment Variables" section: the
  workflow needs none.

### Trigger method

Per `.github/workflows/ci.yml`'s `on:` block, any of:

- Push a commit to `main` or `develop`.
- Open or update a pull request targeting `main` or `develop`.
- Manually run it via the GitHub Actions UI ("Run workflow" —
  `workflow_dispatch`), from the Actions tab for this repository.

### Expected jobs and what each should show green

Per `docs/ci.md` (unchanged by this task):

1. **`backend`** — default test suite, the ~10,000-employee scale suite,
   `alembic upgrade head`, `alembic check`.
2. **`backend-postgres`** — provisions a `postgres:16-alpine` service
   container with CI-only credentials, applies migrations, runs the
   opt-in PostgreSQL integration test. Confirm in the job log that the
   `postgres` service container started and reported healthy before the
   test step ran.
3. **`frontend`** — lint, `tsc -b`, test suite, production build.
4. **`docker-build`** — builds both Docker images and runs
   `docker compose config` with placeholder values; no push, no deploy.

### How to inspect a failed job

- Open the failed workflow run in the Actions tab, expand the failed job,
  and expand the specific failed step — GitHub Actions shows the full
  command output inline.
- Cross-reference the failing step's name against `docs/ci.md`'s table of
  "local equivalent" commands to reproduce it on your own machine.
- Confirm the failure is a real one and not a masked skip: check that no
  step shows a "skipped" status where a real check was expected, and that
  the job's overall conclusion is `failure`, not `success` with an
  ignored step (this workflow has no `continue-on-error` anywhere — see
  `docs/ci.md`).

### Recording the result

When you do run this for real, record at minimum:

- The workflow run URL (`https://github.com/<org>/<repo>/actions/runs/<id>`).
- The commit SHA it ran against (shown on the run page, and via
  `git rev-parse HEAD` locally at the time you pushed/triggered it).
- Each job's conclusion (success/failure) and, for any failure, which step
  and a link to its log.

This document does not fill in an example of that record — an operator who
actually runs it should replace this paragraph with the real run's details
rather than leave a placeholder that looks like evidence.

---

## 6. Summary: What's Automated vs. Manual vs. Still Unverified

| Item | Automated by `scripts/staging-verify.sh`? | Executed as part of this task? |
|---|---|---|
| Docker/Compose prerequisite detection | Yes | Yes — confirmed correctly reports `BLOCKED` in an environment without Docker (see the commit's verification report) |
| Image build, container startup, DB readiness | Yes | **No** — requires Docker, unavailable here |
| Migrations, seed data | Yes | **No** — same reason |
| Backend API checks (auth, CRUD, validation, CORS, analytics) | Yes | **No** — same reason |
| Frontend container serves HTTP | Yes (HTTP-level only) | **No** — same reason |
| Browser-based UI checklist (Section 4) | No — manual | **No** — no browser/automation tool available |
| Remote CI execution (Section 5) | No — manual, requires push access | **No** — pushing to remote is out of scope for this repository's current working process |

If you are the operator picking this up next: run `scripts/staging-verify.sh`
first (it's fully automated and self-cleaning), then work through Section 4
with a real browser against the same stack (`STAGING_KEEP_UP=1`), then
follow Section 5 when you're ready to push. Update this table's "Executed"
column with real results as you go, rather than leaving it as-is.
