import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.main import app
from app.models.employee import Employee
from app.services import employee_service
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


@pytest.fixture()
def unsafe_client(db_session: Session) -> TestClient:
    """Like the shared `client` fixture, but lets a `500` reach the response.

    The shared `client` fixture uses `TestClient`'s default
    `raise_server_exceptions=True`, which re-raises an unhandled exception
    in the test process instead of returning the response the app's own
    `500` handler produced (Starlette does this deliberately, so real bugs
    still surface loudly in tests). Only the "simulate an unexpected
    failure" tests below need to inspect that handler's actual response, so
    this fixture is scoped to this file rather than changed globally.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, api_token=TEST_API_TOKEN
    )
    try:
        yield TestClient(
            app,
            raise_server_exceptions=False,
            headers={"Authorization": f"Bearer {TEST_API_TOKEN}"},
        )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_settings, None)


# --- Application errors (AppError -> app_error_handler) ------------------


def test_employee_not_found_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    response = client.get("/api/v1/employees/999999")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "EMPLOYEE_NOT_FOUND",
            "message": "Employee 999999 not found",
            "details": None,
        }
    }


def test_salary_not_found_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.get(f"/api/v1/employees/{employee.id}/salary")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "SALARY_NOT_FOUND",
            "message": f"No salary record found for employee {employee.id}",
            "details": None,
        }
    }


def test_invalid_sort_field_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    response = client.get("/api/v1/employees", params={"sort_by": "not_a_field"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "INVALID_SORT_FIELD"
    assert "not_a_field" in body["error"]["message"]


def test_salaries_invalid_sort_field_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    response = client.get("/api/v1/salaries", params={"sort_by": "not_a_field"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_SORT_FIELD"


# --- Request validation errors (RequestValidationError) -------------------


def test_invalid_pagination_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    response = client.get("/api/v1/employees", params={"page": 0})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["message"]
    assert isinstance(body["error"]["details"], list)
    detail = body["error"]["details"][0]
    assert set(detail.keys()) == {"location", "message", "type"}
    assert "page" in detail["location"]


def test_invalid_page_size_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    response = client.get("/api/v1/employees", params={"page_size": 0})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_invalid_salary_filter_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    response = client.get("/api/v1/salaries", params={"min_amount": "-1"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert any("min_amount" in detail["location"] for detail in body["error"]["details"])


def test_invalid_employee_id_path_param_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    response = client.get("/api/v1/employees/not-a-number")

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert any("employee_id" in detail["location"] for detail in body["error"]["details"])


def test_invalid_sort_order_uses_standard_error_envelope(
    client: TestClient, db_session: Session
) -> None:
    response = client.get("/api/v1/employees", params={"sort_order": "sideways"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


# --- Expected vs. unexpected error logging (NFR 4.7) -----------------------


def test_expected_app_error_is_logged_at_warning_not_error(
    client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="app"):
        response = client.get("/api/v1/employees/999999")

    assert response.status_code == 404
    app_records = [record for record in caplog.records if record.name == "app"]
    assert len(app_records) == 1
    assert app_records[0].levelno == logging.WARNING
    assert app_records[0].exc_info is None


def test_expected_app_error_log_identifies_it_as_expected(
    client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="app"):
        response = client.get("/api/v1/employees/999999")

    assert response.status_code == 404
    [record] = [r for r in caplog.records if r.name == "app"]
    message = record.getMessage().lower()
    assert "expected" in message
    assert "unhandled" not in message


def test_expected_app_error_log_includes_useful_context(
    client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="app"):
        response = client.get("/api/v1/employees/999999")

    assert response.status_code == 404
    [record] = [r for r in caplog.records if r.name == "app"]
    message = record.getMessage()
    assert "GET" in message
    assert "/api/v1/employees/999999" in message
    assert "EMPLOYEE_NOT_FOUND" in message
    assert "404" in message


def test_expected_app_error_log_does_not_include_sensitive_data(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The response body's `message` may echo caller-supplied/domain detail

    (here standing in for something sensitive); it must never also land in
    the server log, which only carries method/path/code/status.
    """

    def _boom(session, employee_id):
        raise NotFoundError(
            code="EMPLOYEE_NOT_FOUND",
            message="Employee salary 999999.99 USD for Jane Confidential not found",
        )

    monkeypatch.setattr(employee_service, "get_employee", _boom)

    with caplog.at_level(logging.WARNING, logger="app"):
        response = client.get("/api/v1/employees/1")

    assert response.status_code == 404
    assert "Jane Confidential" in response.json()["error"]["message"]

    app_log_text = "\n".join(record.getMessage() for record in caplog.records if record.name == "app")
    assert "Jane Confidential" not in app_log_text
    assert "999999.99" not in app_log_text
    assert "USD" not in app_log_text


def test_unexpected_error_still_logged_at_error_with_traceback_and_distinct_wording(
    unsafe_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The other half of NFR 4.7: unexpected failures stay distinguishable

    from expected ones — `ERROR` level, a traceback, and wording that never
    claims to be "expected".
    """

    def _boom(session, employee_id):
        raise RuntimeError("simulated database failure")

    monkeypatch.setattr(employee_service, "get_employee", _boom)

    with caplog.at_level(logging.WARNING, logger="app"):
        response = unsafe_client.get("/api/v1/employees/1")

    assert response.status_code == 500
    app_records = [record for record in caplog.records if record.name == "app"]
    assert len(app_records) == 1
    record = app_records[0]
    assert record.levelno == logging.ERROR
    assert record.exc_info is not None
    assert "unhandled" in record.getMessage().lower()
    assert "expected" not in record.getMessage().lower()


# --- Unexpected errors (bare Exception -> unhandled_exception_handler) ----


def test_unexpected_service_failure_returns_generic_500(
    unsafe_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(session, employee_id):
        raise RuntimeError("db connection string: postgresql://user:hunter2@localhost/prod")

    monkeypatch.setattr(employee_service, "get_employee", _boom)

    response = unsafe_client.get("/api/v1/employees/1")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred.",
            "details": None,
        }
    }


def test_unexpected_service_failure_does_not_leak_internal_details(
    unsafe_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(session, employee_id):
        raise RuntimeError("db connection string: postgresql://user:hunter2@localhost/prod")

    monkeypatch.setattr(employee_service, "get_employee", _boom)

    response = unsafe_client.get("/api/v1/employees/1")

    body_text = response.text
    assert "hunter2" not in body_text
    assert "RuntimeError" not in body_text
    assert "Traceback" not in body_text


def test_unexpected_service_failure_is_logged(
    unsafe_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    def _boom(session, employee_id):
        raise RuntimeError("simulated database failure")

    monkeypatch.setattr(employee_service, "get_employee", _boom)

    with caplog.at_level(logging.ERROR, logger="app"):
        response = unsafe_client.get("/api/v1/employees/1")

    assert response.status_code == 500
    assert any(
        record.levelno == logging.ERROR and record.exc_info for record in caplog.records
    )


# --- Consistency across endpoints ------------------------------------------


def test_all_404_errors_share_the_same_top_level_shape(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    employee_not_found = client.get("/api/v1/employees/999999")
    salary_not_found = client.get(f"/api/v1/employees/{employee.id}/salary")
    salary_summary_not_found = client.get(f"/api/v1/employees/{employee.id}/salary/summary")

    for response in (employee_not_found, salary_not_found, salary_summary_not_found):
        assert response.status_code == 404
        body = response.json()
        assert set(body.keys()) == {"error"}
        assert set(body["error"].keys()) == {"code", "message", "details"}


def test_all_422_errors_share_the_same_top_level_shape(
    client: TestClient, db_session: Session
) -> None:
    responses = [
        client.get("/api/v1/employees", params={"sort_by": "bogus"}),
        client.get("/api/v1/employees", params={"page": 0}),
        client.get("/api/v1/salaries", params={"min_amount": "-1"}),
    ]

    for response in responses:
        assert response.status_code == 422
        body = response.json()
        assert set(body.keys()) == {"error"}
        assert set(body["error"].keys()) == {"code", "message", "details"}


def test_successful_employee_listing_response_is_unchanged(
    client: TestClient, db_session: Session
) -> None:
    db_session.add(_employee(1))
    db_session.commit()

    response = client.get("/api/v1/employees")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "page", "page_size", "total", "has_next"}
    assert "error" not in body
