from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import ServiceUnavailableError
from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, str]:
    """Liveness check: report that the API process is up.

    Does not touch the database — see `/health/ready` for that. Intentionally
    unauthenticated, like `/health/ready`, so container/orchestration
    tooling can probe it without credentials.
    """
    return {"status": "ok"}


@router.get("/health/ready", responses={503: {"description": "Database is not reachable"}})
def get_readiness(db: Session = Depends(get_db)) -> dict[str, str]:
    """Readiness check: report whether the API can currently reach the database.

    Runs a minimal, read-only `SELECT 1` round trip — it never reads or
    writes application data. Distinct from `/health` (is the process up) so
    container orchestration (e.g. Docker Compose's `service_healthy`
    condition, or a Kubernetes readiness probe) can hold off routing traffic
    to this instance, or starting dependent services, until the database is
    actually reachable — not just the API process.
    """
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise ServiceUnavailableError(
            code="DATABASE_UNAVAILABLE",
            message="The database is not currently reachable.",
        ) from exc
    return {"status": "ok"}
