# PayScope backend — production-oriented container image.
#
# Runs the same FastAPI application as local development
# (backend/README.md), via a production server command (no --reload).
# Migrations are a separate, explicit step (see docs/deployment.md) —
# this image does not run `alembic upgrade head` automatically on start.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Only what's needed to install and run the app: the dependency manifest,
# the application package, and the Alembic migration files (alembic is now
# a runtime dependency — see pyproject.toml). Test files, local .env files,
# and the local SQLite database are excluded via .dockerignore.
COPY pyproject.toml ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic

# Installs only the base (non-dev) dependency group declared in
# pyproject.toml — pytest/httpx are not installed in this image.
RUN pip install --no-cache-dir .

# Run as a non-root user.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Liveness only (no database round trip) — see /health/ready for a
# database-connectivity check, used by docker-compose.yml instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1

# Production server command: no --reload (that's local-development-only,
# see backend/README.md). PAYSCOPE_* environment variables (database URL,
# JWT secret, CORS origins, etc.) are supplied at container run time, never
# baked into the image — see docs/deployment.md.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
