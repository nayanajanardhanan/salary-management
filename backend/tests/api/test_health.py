from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import app


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_returns_ok_when_database_reachable(unauthenticated_client: TestClient) -> None:
    """`/health/ready` requires no auth and succeeds against a real, reachable database."""
    response = unauthenticated_client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_returns_503_when_database_unreachable(unauthenticated_client: TestClient) -> None:
    """`/health/ready` reports 503 (not a raw 500) when the database can't be reached.

    Overrides `get_db` with a session stand-in whose `execute` always raises
    `OperationalError`, simulating an unreachable database without needing a
    real broken connection.
    """

    class _UnreachableSession:
        def execute(self, *args: object, **kwargs: object) -> None:
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    app.dependency_overrides[get_db] = lambda: _UnreachableSession()

    response = unauthenticated_client.get("/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "DATABASE_UNAVAILABLE"
    # No connection string, credentials, or other database detail leaks into the response.
    assert "connection refused" not in body["error"]["message"]
