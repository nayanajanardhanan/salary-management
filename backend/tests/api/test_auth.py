"""Authentication tests for the `/api/v1` employee/salary/analytics API.

Covers `docs/requirements.md` NFR 4.4 and Acceptance Criterion 8.10: an
unauthenticated request must not return employee or salary data. Uses the
`unauthenticated_client` fixture (no `Authorization` header, but a known
test token configured server-side via a `get_settings` override) so these
tests behave identically regardless of local `.env` configuration.
"""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.salary import Salary
from tests.conftest import TEST_API_TOKEN


def _employee(index: int = 1, **overrides) -> Employee:
    fields = dict(
        employee_code=f"EMP-{index:03d}",
        first_name=f"First{index}",
        last_name=f"Last{index}",
        department="Engineering",
        country="UK",
        job_title="Software Engineer",
    )
    fields.update(overrides)
    return Employee(**fields)


def _seed_employee_with_salary(
    db_session: Session, index: int = 1, *, amount: str = "95000.00", currency: str = "GBP"
) -> Employee:
    employee = _employee(index)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal(amount), currency=currency))
    db_session.commit()
    return employee


# --- Unauthenticated requests must not return data (Acceptance Criterion 8.10) --


def test_unauthenticated_employee_listing_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _seed_employee_with_salary(db_session)

    response = unauthenticated_client.get("/api/v1/employees")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    assert "items" not in response.json()


def test_unauthenticated_employee_details_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = unauthenticated_client.get(f"/api/v1/employees/{employee.id}")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_unauthenticated_employee_salary_details_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = unauthenticated_client.get(f"/api/v1/employees/{employee.id}/details")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_unauthenticated_employee_salary_endpoint_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = unauthenticated_client.get(f"/api/v1/employees/{employee.id}/salary")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_unauthenticated_salary_listing_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _seed_employee_with_salary(db_session)

    response = unauthenticated_client.get("/api/v1/salaries")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    assert "items" not in response.json()


def test_unauthenticated_analytics_endpoint_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    _seed_employee_with_salary(db_session)

    response = unauthenticated_client.get("/api/v1/analytics/salary")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    assert "overall" not in response.json()


def test_unauthenticated_health_endpoint_still_succeeds(
    unauthenticated_client: TestClient,
) -> None:
    """`/health` is a liveness check, not employee/salary data, so it stays public."""
    response = unauthenticated_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# --- Invalid/malformed credentials must also be rejected (401) -----------------


def test_invalid_token_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    response = unauthenticated_client.get(
        "/api/v1/employees", headers={"Authorization": "Bearer wrong-token"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_malformed_authorization_header_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    response = unauthenticated_client.get(
        "/api/v1/employees", headers={"Authorization": f"Basic {TEST_API_TOKEN}"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_empty_bearer_token_returns_401(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    response = unauthenticated_client.get(
        "/api/v1/employees", headers={"Authorization": "Bearer "}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


# --- A valid token continues to work exactly as before --------------------------


def test_valid_token_employee_listing_succeeds(
    client: TestClient, db_session: Session
) -> None:
    _seed_employee_with_salary(db_session)

    response = client.get("/api/v1/employees")

    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_valid_token_salary_listing_succeeds(client: TestClient, db_session: Session) -> None:
    _seed_employee_with_salary(db_session)

    response = client.get("/api/v1/salaries")

    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_valid_token_analytics_succeeds(client: TestClient, db_session: Session) -> None:
    _seed_employee_with_salary(db_session)

    response = client.get("/api/v1/analytics/salary")

    assert response.status_code == 200
    assert response.json()["overall"]


def test_explicit_valid_bearer_token_is_accepted(
    unauthenticated_client: TestClient, db_session: Session
) -> None:
    """Sanity-checks the fixed test token itself, independent of the `client` fixture."""
    response = unauthenticated_client.get(
        "/api/v1/employees", headers={"Authorization": f"Bearer {TEST_API_TOKEN}"}
    )

    assert response.status_code == 200
