#!/usr/bin/env bash
# PayScope — portable staging verification script.
#
# Builds and starts the existing docker-compose.yml stack under an isolated
# project name, waits for real database readiness (no fixed sleeps), runs
# migrations, optionally seeds a small test dataset, and exercises the
# backend API. Every check is reported as one of four states — PASS, FAIL,
# BLOCKED, or NOT RUN — never silently skipped or mislabeled:
#   PASS     - executed, and it worked.
#   FAIL     - executed, and it did not work.
#   BLOCKED  - could not be executed because a prerequisite is missing
#              (Docker, Compose, the daemon, or a required earlier step).
#   NOT RUN  - deliberately not attempted (e.g. bulk seeding skipped via
#              STAGING_SKIP_SEED, or a step that is documented as manual —
#              see docs/staging-verification.md for the browser checklist
#              and CI-execution process this script does not cover).
#
# This script does not perform browser-based UI verification and does not
# trigger or report on remote CI — see docs/staging-verification.md for
# both. It never touches backend/payscope.db or any other Docker Compose
# project — it creates its own isolated project name, ports, and database
# volume, and removes them on exit.
#
# Usage:
#   ./scripts/verify-staging.sh
#
# Optional environment overrides:
#   STAGING_BACKEND_PORT    (default: 18000)
#   STAGING_FRONTEND_PORT   (default: 18080)
#   STAGING_SEED_COUNT      (default: 25 — a small, documented test dataset)
#   STAGING_SKIP_SEED       (default: unset; set to "1" to skip bulk
#                            employee/salary seeding — the HR login user is
#                            still ensured so authentication can be tested)
#   STAGING_HR_USERNAME     (default: "staging.verify")
#   STAGING_HR_EMAIL        (default: "staging.verify@example.test")
#   STAGING_HR_PASSWORD     (default: randomly generated — set this to test
#                            with your own known staging-only credentials)
#   STAGING_KEEP_UP         (default: unset; set to "1" to skip cleanup,
#                            e.g. for manual browser follow-up)
#
# Exit codes: 0 = every executed check passed (FAIL count is zero).
#             1 = at least one check FAILed.
#             2 = blocked before any check could run (missing Docker,
#                 Compose, or an unreachable daemon).

set -uo pipefail

# --- configuration -----------------------------------------------------

PROJECT_NAME="payscope-staging-verify"
BACKEND_PORT="${STAGING_BACKEND_PORT:-18000}"
FRONTEND_PORT="${STAGING_FRONTEND_PORT:-18080}"
SEED_COUNT="${STAGING_SEED_COUNT:-25}"
SKIP_SEED="${STAGING_SKIP_SEED:-}"
HR_USERNAME="${STAGING_HR_USERNAME:-staging.verify}"
HR_EMAIL="${STAGING_HR_EMAIL:-staging.verify@example.test}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"
READY_TIMEOUT_SECONDS=90
READY_POLL_INTERVAL_SECONDS=3

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TMP_DIR=""
ENV_FILE=""
COMPOSE=()
STARTED_STACK=0

# --- result tracking -----------------------------------------------------
# Four states only: PASS, FAIL, BLOCKED, NOT_RUN (printed as "NOT RUN").

declare -a RESULT_NAMES=()
declare -a RESULT_STATUSES=()
declare -a RESULT_DETAILS=()
ANY_FAIL=0
ANY_BLOCKED=0

record() {
  RESULT_NAMES+=("$1")
  RESULT_STATUSES+=("$2")
  RESULT_DETAILS+=("$3")
  case "$2" in
    PASS) printf '[PASS]    %s (%s)\n' "$1" "$3" ;;
    FAIL) printf '[FAIL]    %s (%s)\n' "$1" "$3"; ANY_FAIL=1 ;;
    BLOCKED) printf '[BLOCKED] %s (%s)\n' "$1" "$3"; ANY_BLOCKED=1 ;;
    NOT_RUN) printf '[NOT RUN] %s (%s)\n' "$1" "$3" ;;
  esac
}

pass() { record "$1" PASS "${2:-}"; }
fail() { record "$1" FAIL "${2:-}"; }
blocked() { record "$1" BLOCKED "${2:-}"; }
not_run() { record "$1" NOT_RUN "${2:-}"; }

print_summary() {
  echo
  echo "===== Staging Verification Summary ====="
  local i
  for i in "${!RESULT_NAMES[@]}"; do
    local label="${RESULT_STATUSES[$i]}"
    [ "$label" = "NOT_RUN" ] && label="NOT RUN"
    printf '%-9s %s\n' "$label" "${RESULT_NAMES[$i]}"
  done
  echo "=========================================="
  echo "Legend: PASS = executed and worked. FAIL = executed and failed."
  echo "BLOCKED = a prerequisite was missing. NOT RUN = deliberately not"
  echo "attempted (opted out, or manual-only — see docs/staging-verification.md)."
}

# --- cleanup -------------------------------------------------------------

cleanup() {
  if [ "${STAGING_KEEP_UP:-}" = "1" ]; then
    echo
    echo "STAGING_KEEP_UP=1 set — leaving the stack running for manual follow-up."
    echo "Compose project: ${PROJECT_NAME}"
    echo "Backend:  ${BACKEND_URL}"
    echo "Frontend: ${FRONTEND_URL}"
    echo "HR login: username='${HR_USERNAME}' (password was generated or came from"
    echo "STAGING_HR_PASSWORD — not printed here; check your own env var, or the"
    echo "env file this run used: ${ENV_FILE:-<not created>})"
    echo "Tear it down yourself when done:"
    echo "  ${COMPOSE[*]:-docker compose} -p ${PROJECT_NAME} --env-file '${ENV_FILE:-<see above>}' down -v"
  elif [ "$STARTED_STACK" = "1" ] && [ -n "${ENV_FILE}" ] && [ -f "${ENV_FILE}" ]; then
    echo
    echo "Cleaning up: stopping and removing the staging stack and its throwaway volume..."
    "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" down -v --remove-orphans \
      >"${TMP_DIR}/compose-down.log" 2>&1 || echo "  (cleanup reported a non-zero exit — see ${TMP_DIR}/compose-down.log if it still exists)"
  fi
  if [ -n "${TMP_DIR}" ] && [ -d "${TMP_DIR}" ] && [ "${STAGING_KEEP_UP:-}" != "1" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

# --- helpers ---------------------------------------------------------------

random_hex() {
  # No fixed dependency on Python or Node on the host — only on what a
  # Docker-capable machine is likely to already have.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import secrets; print(secrets.token_hex(32))"
  elif command -v python >/dev/null 2>&1; then
    python -c "import secrets; print(secrets.token_hex(32))"
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

json_field() {
  # Extracts a top-level string field from a small, flat JSON blob without
  # requiring a JSON tool on the host. Not a general JSON parser — good
  # enough for this script's own predictable response shapes.
  local field="$1" file="$2"
  grep -o "\"${field}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$file" 2>/dev/null \
    | head -n1 | sed -E "s/.*:\s*\"([^\"]*)\"/\1/"
}

http_check() {
  # http_check NAME METHOD PATH EXPECTED_STATUS [DATA_JSON] [BEARER_TOKEN]
  local name="$1" method="$2" path="$3" expected="$4" data="${5:-}" token="${6:-}"
  local body_file="${TMP_DIR}/last_response.json"
  local -a args=(-s -o "$body_file" -w '%{http_code}' -X "$method" "${BACKEND_URL}${path}")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
  if [ -n "$data" ]; then
    args+=(-H "Content-Type: application/json" -d "$data")
  fi
  local status
  if ! status=$(curl --max-time 10 "${args[@]}" 2>"${TMP_DIR}/curl_err.log"); then
    fail "$name" "curl failed to connect — see ${TMP_DIR}/curl_err.log"
    return 1
  fi
  if [ "$status" = "$expected" ]; then
    pass "$name" "HTTP $status"
    return 0
  else
    local snippet
    snippet=$(head -c 200 "$body_file" 2>/dev/null | tr '\n' ' ')
    fail "$name" "expected HTTP $expected, got $status — $snippet"
    return 1
  fi
}

# --- 1. tool precheck --------------------------------------------------------

echo "=== 1. Environment precheck ==="

if ! command -v docker >/dev/null 2>&1; then
  blocked "docker installed" "the 'docker' command was not found on PATH"
  blocked "docker compose available" "cannot check — Docker itself is missing"
  blocked "all remaining staging checks" "Docker is required for this script; see docs/staging-verification.md for the manual runbook and prerequisites"
  print_summary
  echo
  echo "Docker is not installed in this environment. Nothing below this point was attempted."
  echo "See docs/staging-verification.md for exact prerequisites and the manual runbook."
  exit 2
fi
pass "docker installed" "$(docker --version 2>/dev/null)"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
  pass "docker compose available" "$(docker compose version 2>/dev/null | head -n1)"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
  pass "docker compose available" "$(docker-compose --version 2>/dev/null)"
else
  blocked "docker compose available" "neither 'docker compose' nor 'docker-compose' is available"
  blocked "all remaining staging checks" "Docker Compose is required for this script"
  print_summary
  exit 2
fi

if ! docker info >/dev/null 2>&1; then
  blocked "docker daemon reachable" "'docker info' failed — is the Docker daemon/Docker Desktop running?"
  blocked "all remaining staging checks" "the Docker daemon must be running, not just installed"
  print_summary
  exit 2
fi
pass "docker daemon reachable" "docker info succeeded"

# --- 2. isolated staging configuration --------------------------------------

echo
echo "=== 2. Preparing isolated staging configuration ==="

TMP_DIR="$(mktemp -d)"
ENV_FILE="${TMP_DIR}/staging.env"

STAGING_POSTGRES_PASSWORD="$(random_hex)"
STAGING_JWT_SECRET="$(random_hex)"
# Test login credentials: supplied through the environment
# (STAGING_HR_PASSWORD) if the operator set one, otherwise generated —
# never a fixed value hardcoded in this script.
HR_PASSWORD="${STAGING_HR_PASSWORD:-$(random_hex)}"

cat >"$ENV_FILE" <<EOF
POSTGRES_DB=payscope_staging_verify
POSTGRES_USER=payscope_staging
POSTGRES_PASSWORD=${STAGING_POSTGRES_PASSWORD}
PAYSCOPE_ENVIRONMENT=staging
PAYSCOPE_DEBUG=false
PAYSCOPE_JWT_SECRET_KEY=${STAGING_JWT_SECRET}
PAYSCOPE_HR_SEED_USERNAME=${HR_USERNAME}
PAYSCOPE_HR_SEED_EMAIL=${HR_EMAIL}
PAYSCOPE_HR_SEED_PASSWORD=${HR_PASSWORD}
PAYSCOPE_CORS_ORIGINS=http://localhost:${FRONTEND_PORT}
PAYSCOPE_LOG_LEVEL=INFO
VITE_API_BASE_URL=${BACKEND_URL}
BACKEND_PORT=${BACKEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
EOF
chmod 600 "$ENV_FILE" 2>/dev/null || true

pass "isolated staging configuration generated" "throwaway/env-supplied credentials written to a temp file (never printed, never committed)"
echo "  Compose project: ${PROJECT_NAME}"
echo "  Backend will be published at:  ${BACKEND_URL}"
echo "  Frontend will be published at: ${FRONTEND_URL}"

# --- 3. build and start ------------------------------------------------------

echo
echo "=== 3. Building images and starting the staging stack ==="

if "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" up -d --build \
    >"${TMP_DIR}/compose-up.log" 2>&1; then
  pass "docker compose build + up" "see ${TMP_DIR}/compose-up.log for full output"
  STARTED_STACK=1
else
  fail "docker compose build + up" "non-zero exit — see ${TMP_DIR}/compose-up.log"
  echo "--- last 40 lines of compose-up.log ---"
  tail -n 40 "${TMP_DIR}/compose-up.log" 2>/dev/null
  print_summary
  exit 1
fi

# Never dump the generated .env file's contents; only check that none of
# the generated secret values leaked into the containers' own log output.
secret_leak=0
for secret_value in "$STAGING_POSTGRES_PASSWORD" "$STAGING_JWT_SECRET" "$HR_PASSWORD"; do
  if "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" logs 2>/dev/null | grep -qF -- "$secret_value"; then
    secret_leak=1
  fi
done
if [ "$secret_leak" = "1" ]; then
  fail "no secrets printed in container logs" "a generated secret value was found in 'compose logs' output"
else
  pass "no secrets printed in container logs" "checked compose logs output for each generated secret value individually"
fi

# --- 4. wait for readiness (poll, not a fixed sleep), then migrate ----------

echo
echo "=== 4. Database readiness and migrations ==="

ready=0
elapsed=0
while [ "$elapsed" -lt "$READY_TIMEOUT_SECONDS" ]; do
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "${BACKEND_URL}/health/ready" 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    ready=1
    break
  fi
  sleep "$READY_POLL_INTERVAL_SECONDS"
  elapsed=$((elapsed + READY_POLL_INTERVAL_SECONDS))
done

if [ "$ready" = "1" ]; then
  pass "backend + database reachable (/health/ready polled, no fixed sleep)" "ready after ~${elapsed}s"
else
  fail "backend + database reachable (/health/ready polled, no fixed sleep)" "did not become ready within ${READY_TIMEOUT_SECONDS}s"
  echo "--- last 40 lines of backend container log ---"
  "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" logs --tail=40 backend 2>/dev/null
  print_summary
  exit 1
fi

if "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" run --rm backend alembic upgrade head \
    >"${TMP_DIR}/migrate.log" 2>&1; then
  pass "alembic upgrade head" "see ${TMP_DIR}/migrate.log"
else
  fail "alembic upgrade head" "non-zero exit — see ${TMP_DIR}/migrate.log"
fi

# --- 5. seed data (documented default; explicitly skippable) ---------------

echo
echo "=== 5. Seed data ==="

if [ "$SKIP_SEED" = "1" ]; then
  # Bulk employee/salary seeding skipped by explicit operator request
  # (STAGING_SKIP_SEED=1). The HR login user is still ensured (--count 0
  # still runs the independent HR-user-seeding step in
  # app/scripts/seed.py), so authentication can still be verified below.
  not_run "bulk employee/salary seeding" "STAGING_SKIP_SEED=1 was set — skipped by explicit request"
  if "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" run --rm backend \
      python -m app.scripts.seed --count 0 >"${TMP_DIR}/seed.log" 2>&1; then
    pass "HR login user ensured (--count 0)" "see ${TMP_DIR}/seed.log"
  else
    fail "HR login user ensured (--count 0)" "non-zero exit — see ${TMP_DIR}/seed.log"
  fi
else
  # Default: seed a small, documented test dataset (see
  # docs/staging-verification.md — this is not the ~10,000-employee scale
  # dataset; override with STAGING_SEED_COUNT if you want a different size).
  if "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" run --rm backend \
      python -m app.scripts.seed --count "$SEED_COUNT" --seed 7 \
      >"${TMP_DIR}/seed.log" 2>&1; then
    pass "seed script (small test dataset, documented default)" "requested ${SEED_COUNT} employees — see ${TMP_DIR}/seed.log"
  elif grep -qi "already has" "${TMP_DIR}/seed.log" 2>/dev/null; then
    # Idempotency guard tripped (e.g. a kept-up stack from a previous run)
    # — this is the seed script correctly refusing to duplicate data, not
    # a failure of this script's own logic.
    pass "seed script (small test dataset, documented default)" "employee/salary data already present from a prior run — seed script's idempotency guard correctly refused to duplicate it (see ${TMP_DIR}/seed.log)"
  else
    fail "seed script (small test dataset, documented default)" "non-zero exit — see ${TMP_DIR}/seed.log"
  fi
fi

# --- 6. backend API verification --------------------------------------------

echo
echo "=== 6. Backend API verification ==="

http_check "GET /health" GET "/health" 200
http_check "GET /health/ready" GET "/health/ready" 200

http_check "login with invalid credentials -> 401" POST "/api/v1/auth/login" 401 \
  "{\"username_or_email\":\"${HR_USERNAME}\",\"password\":\"deliberately-wrong-password\"}"

http_check "protected endpoint without a token -> 401" GET "/api/v1/employees" 401

login_body="${TMP_DIR}/login.json"
login_status=$(curl -s -o "$login_body" -w '%{http_code}' --max-time 10 -X POST \
  "${BACKEND_URL}/api/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"username_or_email\":\"${HR_USERNAME}\",\"password\":\"${HR_PASSWORD}\"}" 2>/dev/null || echo "000")
TOKEN=""
if [ "$login_status" = "200" ]; then
  TOKEN="$(json_field access_token "$login_body")"
fi
if [ "$login_status" = "200" ] && [ -n "$TOKEN" ]; then
  pass "login with the configured test credentials -> 200 + token" "HTTP $login_status"
else
  fail "login with the configured test credentials -> 200 + token" "HTTP $login_status (see ${login_body})"
fi

if [ -n "$TOKEN" ]; then
  http_check "authenticated employee listing -> 200" GET "/api/v1/employees" 200 "" "$TOKEN"
  http_check "employee search -> 200" GET "/api/v1/employees?search=EMP-000001" 200 "" "$TOKEN"
  http_check "department/country filters -> 200" GET "/api/v1/employees?department=Engineering&country=United%20Kingdom" 200 "" "$TOKEN"
  http_check "employee sorting -> 200" GET "/api/v1/employees?sort_by=last_name&sort_order=desc" 200 "" "$TOKEN"
  http_check "pagination (page_size=5) -> 200" GET "/api/v1/employees?page=1&page_size=5" 200 "" "$TOKEN"
  http_check "salary analytics -> 200" GET "/api/v1/analytics/salary" 200 "" "$TOKEN"

  create_body="${TMP_DIR}/create_emp.json"
  create_status=$(curl -s -o "$create_body" -w '%{http_code}' --max-time 10 -X POST \
    "${BACKEND_URL}/api/v1/employees" -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"employee_code":"EMP-STAGING001","first_name":"Staging","last_name":"Verify","department":"Engineering","country":"United Kingdom","job_title":"Verification Engineer","employment_status":"active"}' \
    2>/dev/null || echo "000")
  NEW_EMPLOYEE_ID="$(json_field id "$create_body")"
  if [ "$create_status" = "201" ] && [ -n "$NEW_EMPLOYEE_ID" ]; then
    pass "employee creation -> 201" "id=${NEW_EMPLOYEE_ID}"
  else
    fail "employee creation -> 201" "HTTP $create_status"
  fi

  if [ -n "$NEW_EMPLOYEE_ID" ]; then
    http_check "employee details -> 200" GET "/api/v1/employees/${NEW_EMPLOYEE_ID}/details" 200 "" "$TOKEN"

    http_check "salary creation -> 201" POST "/api/v1/employees/${NEW_EMPLOYEE_ID}/salary" 201 \
      '{"amount":"95000.00","currency":"GBP"}' "$TOKEN"

    http_check "duplicate salary rejected -> 409 (one-active-salary-per-employee)" POST \
      "/api/v1/employees/${NEW_EMPLOYEE_ID}/salary" 409 '{"amount":"1.00","currency":"USD"}' "$TOKEN"

    http_check "invalid currency rejected -> 422" POST "/api/v1/employees/${NEW_EMPLOYEE_ID}/salary" 422 \
      '{"amount":"1000.00","currency":"ZZZ"}' "$TOKEN"

    http_check "negative salary amount rejected -> 422" POST "/api/v1/employees/${NEW_EMPLOYEE_ID}/salary" 422 \
      '{"amount":"-500.00","currency":"USD"}' "$TOKEN"

    http_check "salary update -> 200" PUT "/api/v1/employees/${NEW_EMPLOYEE_ID}/salary" 200 \
      '{"amount":"99000.00","currency":"GBP"}' "$TOKEN"

    http_check "salary deletion -> 204" DELETE "/api/v1/employees/${NEW_EMPLOYEE_ID}/salary" 204 "" "$TOKEN"
    http_check "salary now missing -> 404" GET "/api/v1/employees/${NEW_EMPLOYEE_ID}/salary" 404 "" "$TOKEN"

    http_check "employee deletion -> 204" DELETE "/api/v1/employees/${NEW_EMPLOYEE_ID}" 204 "" "$TOKEN"
    http_check "employee now missing -> 404" GET "/api/v1/employees/${NEW_EMPLOYEE_ID}" 404 "" "$TOKEN"
  else
    blocked "employee details / salary CRUD / deletion checks" "employee creation did not return a usable id"
  fi
else
  blocked "authenticated backend checks" "login did not return a token"
fi

cors_allowed_headers="${TMP_DIR}/cors_allowed.headers"
curl -s -D "$cors_allowed_headers" -o /dev/null --max-time 10 -X OPTIONS "${BACKEND_URL}/api/v1/employees" \
  -H "Origin: http://localhost:${FRONTEND_PORT}" -H "Access-Control-Request-Method: GET" >/dev/null 2>&1 || true
if grep -qi "access-control-allow-origin" "$cors_allowed_headers" 2>/dev/null; then
  pass "CORS preflight from the configured frontend origin is allowed" "access-control-allow-origin present"
else
  fail "CORS preflight from the configured frontend origin is allowed" "no access-control-allow-origin header in response"
fi

cors_disallowed_headers="${TMP_DIR}/cors_disallowed.headers"
curl -s -D "$cors_disallowed_headers" -o /dev/null --max-time 10 -X OPTIONS "${BACKEND_URL}/api/v1/employees" \
  -H "Origin: http://evil.example.test" -H "Access-Control-Request-Method: GET" >/dev/null 2>&1 || true
if grep -qi "access-control-allow-origin" "$cors_disallowed_headers" 2>/dev/null; then
  fail "CORS preflight from a disallowed origin is rejected" "access-control-allow-origin was present for an untrusted origin"
else
  pass "CORS preflight from a disallowed origin is rejected" "no access-control-allow-origin header granted"
fi

# --- 7. frontend container (HTTP-level only — not a browser check) ---------

echo
echo "=== 7. Frontend container smoke check (HTTP-level only) ==="
echo "NOTE: this confirms the frontend container builds, starts, and serves"
echo "content over HTTP. It is NOT a substitute for the browser-based"
echo "checklist in docs/staging-verification.md."

frontend_body="${TMP_DIR}/frontend_root.html"
frontend_status=$(curl -s -o "$frontend_body" -w '%{http_code}' --max-time 10 "${FRONTEND_URL}/" 2>/dev/null || echo "000")
if [ "$frontend_status" = "200" ] && grep -qi "PayScope" "$frontend_body" 2>/dev/null; then
  pass "frontend container serves the app shell over HTTP" "HTTP $frontend_status, page title found"
else
  fail "frontend container serves the app shell over HTTP" "HTTP $frontend_status"
fi

not_run "browser-based UI checklist" "requires a real browser or browser automation tool — see docs/staging-verification.md"
not_run "remote CI execution" "requires push/PR access to trigger GitHub Actions — see docs/staging-verification.md"

# --- summary ------------------------------------------------------------

print_summary

if [ "$ANY_FAIL" = "1" ]; then
  echo "Result: one or more checks FAILED. Do not treat staging as verified."
  exit 1
elif [ "$ANY_BLOCKED" = "1" ]; then
  echo "Result: some checks were BLOCKED and could not run."
  exit 2
else
  echo "Result: every executed check PASSED. Browser-based UI verification"
  echo "and remote CI execution are separate, unautomated steps (reported"
  echo "above as NOT RUN) — see docs/staging-verification.md."
  exit 0
fi
