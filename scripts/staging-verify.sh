#!/usr/bin/env bash
# PayScope — portable staging verification script.
#
# Builds and starts the existing docker-compose.yml stack under an isolated
# project name and throwaway, randomly-generated credentials, runs
# migrations and a small seed dataset, and exercises the backend API and
# the frontend container's HTTP endpoint. Every check is reported as
# PASS, FAIL, or BLOCKED — nothing is silently skipped or mislabeled.
#
# This script does not perform browser-based UI verification (see
# docs/staging-verification.md for that checklist) and does not trigger or
# report on remote CI (see the same document for that process). It never
# touches backend/payscope.db or any non-staging Docker Compose project —
# it creates its own isolated project name, ports, and database volume,
# and removes them on exit.
#
# Usage:
#   ./scripts/staging-verify.sh
#
# Optional environment overrides:
#   STAGING_BACKEND_PORT   (default: 18000)
#   STAGING_FRONTEND_PORT  (default: 18080)
#   STAGING_SEED_COUNT     (default: 25 — a small test dataset, not 10,000)
#   STAGING_KEEP_UP        (default: unset — set to "1" to skip cleanup,
#                            e.g. for manual follow-up/browser testing)
#
# Exit codes: 0 = every executed check passed. 1 = at least one check
# failed. 2 = blocked before any check could run (missing Docker/Compose,
# or the Docker daemon isn't reachable).

set -uo pipefail

# --- configuration -----------------------------------------------------

PROJECT_NAME="payscope-staging-verify"
BACKEND_PORT="${STAGING_BACKEND_PORT:-18000}"
FRONTEND_PORT="${STAGING_FRONTEND_PORT:-18080}"
SEED_COUNT="${STAGING_SEED_COUNT:-25}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"
READY_TIMEOUT_SECONDS=90

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TMP_DIR=""
ENV_FILE=""
COMPOSE=()
STARTED_STACK=0

# --- result tracking -----------------------------------------------------

declare -a RESULT_NAMES=()
declare -a RESULT_STATUSES=()
declare -a RESULT_DETAILS=()
ANY_FAIL=0
ANY_BLOCKED=0

record() {
  # record NAME STATUS DETAIL
  RESULT_NAMES+=("$1")
  RESULT_STATUSES+=("$2")
  RESULT_DETAILS+=("$3")
  case "$2" in
    PASS) printf '[PASS]    %s (%s)\n' "$1" "$3" ;;
    FAIL) printf '[FAIL]    %s (%s)\n' "$1" "$3"; ANY_FAIL=1 ;;
    BLOCKED) printf '[BLOCKED] %s (%s)\n' "$1" "$3"; ANY_BLOCKED=1 ;;
  esac
}

pass() { record "$1" PASS "${2:-}"; }
fail() { record "$1" FAIL "${2:-}"; }
blocked() { record "$1" BLOCKED "${2:-}"; }

print_summary() {
  echo
  echo "===== Staging Verification Summary ====="
  local i
  for i in "${!RESULT_NAMES[@]}"; do
    printf '%-9s %s\n' "${RESULT_STATUSES[$i]}" "${RESULT_NAMES[$i]}"
  done
  echo "========================================="
}

# --- cleanup -------------------------------------------------------------

cleanup() {
  if [ "${STAGING_KEEP_UP:-}" = "1" ]; then
    echo
    echo "STAGING_KEEP_UP=1 set — leaving the stack running for manual follow-up."
    echo "Stack is under Compose project '${PROJECT_NAME}'."
    echo "Backend:  ${BACKEND_URL}"
    echo "Frontend: ${FRONTEND_URL}"
    echo "Tear it down yourself later with:"
    echo "  docker compose -p ${PROJECT_NAME} --env-file <(unset) down -v"
    echo "  (or re-run this script without STAGING_KEEP_UP to clean up automatically)"
  elif [ "$STARTED_STACK" = "1" ] && [ -n "${ENV_FILE}" ] && [ -f "${ENV_FILE}" ]; then
    echo
    echo "Cleaning up: stopping and removing the staging stack and its throwaway volume..."
    "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" down -v --remove-orphans \
      >"${TMP_DIR}/compose-down.log" 2>&1 || echo "  (cleanup command reported a non-zero exit — see ${TMP_DIR}/compose-down.log if it still exists)"
  fi
  if [ -n "${TMP_DIR}" ] && [ -d "${TMP_DIR}" ] && [ "${STAGING_KEEP_UP:-}" != "1" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

# --- helpers ---------------------------------------------------------------

random_hex() {
  # 32 random bytes as hex, tried in order of what's most likely available
  # on a Docker-capable host without assuming Python or Node are installed.
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
  # Extract a top-level string/number field from a small, flat JSON blob
  # without requiring a JSON tool on the host. Good enough for this
  # script's own predictable response shapes; not a general JSON parser.
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
STAGING_HR_PASSWORD="$(random_hex)"

cat >"$ENV_FILE" <<EOF
POSTGRES_DB=payscope_staging_verify
POSTGRES_USER=payscope_staging
POSTGRES_PASSWORD=${STAGING_POSTGRES_PASSWORD}
PAYSCOPE_ENVIRONMENT=staging
PAYSCOPE_DEBUG=false
PAYSCOPE_JWT_SECRET_KEY=${STAGING_JWT_SECRET}
PAYSCOPE_HR_SEED_USERNAME=staging.verify
PAYSCOPE_HR_SEED_EMAIL=staging.verify@example.test
PAYSCOPE_HR_SEED_PASSWORD=${STAGING_HR_PASSWORD}
PAYSCOPE_CORS_ORIGINS=http://localhost:${FRONTEND_PORT}
PAYSCOPE_LOG_LEVEL=INFO
VITE_API_BASE_URL=${BACKEND_URL}
BACKEND_PORT=${BACKEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
EOF
chmod 600 "$ENV_FILE" 2>/dev/null || true

pass "isolated staging configuration generated" "throwaway credentials written to a temp file (never printed, never committed)"
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

# Never dump the generated .env file's contents; only Compose's own
# container-level logs are shown, and only on failure below.
if "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" logs 2>/dev/null \
    | grep -qi "${STAGING_POSTGRES_PASSWORD}\|${STAGING_JWT_SECRET}\|${STAGING_HR_PASSWORD}"; then
  fail "no secrets printed in container logs" "a generated secret value was found in 'compose logs' output"
else
  pass "no secrets printed in container logs" "checked compose logs output for the generated password/secret values"
fi

# --- 4. wait for readiness, then migrate + seed ------------------------------

echo
echo "=== 4. Database readiness, migrations, and seed data ==="

ready=0
elapsed=0
while [ "$elapsed" -lt "$READY_TIMEOUT_SECONDS" ]; do
  if curl -s -o /dev/null --max-time 3 "${BACKEND_URL}/health/ready"; then
    status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "${BACKEND_URL}/health/ready" 2>/dev/null || echo "000")
    if [ "$status" = "200" ]; then
      ready=1
      break
    fi
  fi
  sleep 3
  elapsed=$((elapsed + 3))
done

if [ "$ready" = "1" ]; then
  pass "backend + database reachable (/health/ready)" "ready after ~${elapsed}s"
else
  fail "backend + database reachable (/health/ready)" "did not become ready within ${READY_TIMEOUT_SECONDS}s"
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

if "${COMPOSE[@]}" -p "$PROJECT_NAME" --env-file "$ENV_FILE" run --rm backend \
    python -m app.scripts.seed --count "$SEED_COUNT" --seed 7 \
    >"${TMP_DIR}/seed.log" 2>&1; then
  pass "seed script (small test dataset)" "requested ${SEED_COUNT} employees — see ${TMP_DIR}/seed.log"
else
  fail "seed script (small test dataset)" "non-zero exit — see ${TMP_DIR}/seed.log"
fi

# --- 5. backend API verification --------------------------------------------

echo
echo "=== 5. Backend API verification ==="

http_check "GET /health" GET "/health" 200
http_check "GET /health/ready" GET "/health/ready" 200

http_check "login with invalid credentials -> 401" POST "/api/v1/auth/login" 401 \
  '{"username_or_email":"staging.verify","password":"deliberately-wrong"}'

http_check "protected endpoint without a token -> 401" GET "/api/v1/employees" 401

login_body="${TMP_DIR}/login.json"
login_status=$(curl -s -o "$login_body" -w '%{http_code}' --max-time 10 -X POST \
  "${BACKEND_URL}/api/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"username_or_email\":\"staging.verify\",\"password\":\"${STAGING_HR_PASSWORD}\"}" 2>/dev/null || echo "000")
TOKEN=""
if [ "$login_status" = "200" ]; then
  TOKEN="$(json_field access_token "$login_body")"
fi
if [ "$login_status" = "200" ] && [ -n "$TOKEN" ]; then
  pass "login with valid seeded credentials -> 200 + token" "HTTP $login_status"
else
  fail "login with valid seeded credentials -> 200 + token" "HTTP $login_status (see ${login_body})"
fi

if [ -n "$TOKEN" ]; then
  http_check "authenticated employee listing -> 200" GET "/api/v1/employees" 200 "" "$TOKEN"
  http_check "employee search -> 200" GET "/api/v1/employees?search=EMP-000001" 200 "" "$TOKEN"
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
    blocked "employee details / salary CRUD / deletion checks" "skipped — employee creation did not return a usable id"
  fi
else
  blocked "authenticated backend checks" "skipped — login did not return a token"
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

# --- 6. frontend container (HTTP-level only — not a browser check) ----------

echo
echo "=== 6. Frontend container smoke check (HTTP-level only) ==="
echo "NOTE: this confirms the frontend container builds, starts, and serves"
echo "content over HTTP. It is NOT a substitute for the browser-based"
echo "checklist in docs/staging-verification.md, and is not reported as one."

frontend_body="${TMP_DIR}/frontend_root.html"
frontend_status=$(curl -s -o "$frontend_body" -w '%{http_code}' --max-time 10 "${FRONTEND_URL}/" 2>/dev/null || echo "000")
if [ "$frontend_status" = "200" ] && grep -qi "PayScope" "$frontend_body" 2>/dev/null; then
  pass "frontend container serves the app shell over HTTP" "HTTP $frontend_status, page title found"
else
  fail "frontend container serves the app shell over HTTP" "HTTP $frontend_status"
fi

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
  echo "and remote CI execution are still separate, unautomated steps — see"
  echo "docs/staging-verification.md."
  exit 0
fi
