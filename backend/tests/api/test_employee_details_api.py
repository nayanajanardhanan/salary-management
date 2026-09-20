from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.salary import Salary

ENDPOINT = "/api/v1/employees"


def _employee(index: int, **overrides) -> Employee:
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


def test_get_employee_details_returns_combined_employee_and_salary(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.get(f"{ENDPOINT}/{employee.id}/details")

    assert response.status_code == 200
    body = response.json()
    assert body["employee"]["id"] == employee.id
    assert body["salary"]["amount"] == "95000.00"
    assert body["salary"]["currency"] == "GBP"


def test_get_employee_details_response_schema(client: TestClient, db_session: Session) -> None:
    employee = _seed_employee_with_salary(db_session)

    body = client.get(f"{ENDPOINT}/{employee.id}/details").json()

    assert set(body.keys()) == {"employee", "salary"}
    assert set(body["employee"].keys()) == {
        "id",
        "employee_code",
        "first_name",
        "last_name",
        "department",
        "country",
        "job_title",
        "employment_status",
    }
    assert set(body["salary"].keys()) == {"employee_id", "amount", "currency"}


def test_get_employee_details_employee_information_is_correct(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(
        1,
        first_name="Ada",
        last_name="Lovelace",
        department="Engineering",
        country="UK",
        job_title="Software Engineer",
        employment_status="inactive",
    )
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    body = client.get(f"{ENDPOINT}/{employee.id}/details").json()

    assert body["employee"] == {
        "id": employee.id,
        "employee_code": "EMP-001",
        "first_name": "Ada",
        "last_name": "Lovelace",
        "department": "Engineering",
        "country": "UK",
        "job_title": "Software Engineer",
        "employment_status": "inactive",
    }


def test_get_employee_details_salary_information_is_correct(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session, amount="123456.78", currency="EUR")

    body = client.get(f"{ENDPOINT}/{employee.id}/details").json()

    assert body["salary"] == {
        "employee_id": employee.id,
        "amount": "123456.78",
        "currency": "EUR",
    }


def test_get_employee_details_is_associated_with_the_correct_employee(
    client: TestClient, db_session: Session
) -> None:
    employee_1 = _seed_employee_with_salary(db_session, index=1, amount="1000.00", currency="USD")
    employee_2 = _seed_employee_with_salary(db_session, index=2, amount="2000.00", currency="EUR")

    response = client.get(f"{ENDPOINT}/{employee_2.id}/details")

    body = response.json()
    assert body["employee"]["id"] == employee_2.id
    assert body["employee"]["employee_code"] == "EMP-002"
    assert body["salary"]["amount"] == "2000.00"
    assert body["salary"]["currency"] == "EUR"


def test_get_employee_details_decimal_precision(client: TestClient, db_session: Session) -> None:
    employee = _seed_employee_with_salary(db_session, amount="100000.10", currency="USD")

    body = client.get(f"{ENDPOINT}/{employee.id}/details").json()

    assert Decimal(body["salary"]["amount"]) == Decimal("100000.10")


def test_get_employee_details_for_nonexistent_employee_returns_404(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(f"{ENDPOINT}/999999/details")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_get_employee_details_for_employee_without_salary_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.get(f"{ENDPOINT}/{employee.id}/details")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SALARY_NOT_FOUND"


def test_get_employee_details_rejects_non_integer_employee_id(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(f"{ENDPOINT}/not-a-number/details")

    assert response.status_code == 422


def test_get_employee_details_issues_a_single_query(
    client: TestClient, db_session: Session
) -> None:
    """The combined lookup must be N+1-safe: fetching an employee together
    with its salary should take exactly one SQL query, via eager loading,
    not one query per resource (docs/architecture.md Section 9)."""
    employee = _seed_employee_with_salary(db_session)
    # Read `.id` now, before listening: `expire_on_commit=True` means this
    # attribute access would otherwise itself trigger an implicit refresh
    # query once capture starts, which isn't part of the endpoint's own
    # query count.
    employee_id = employee.id

    statements = []

    def _capture(conn, cursor, statement, parameters, context, executemany):
        if statement.strip().upper().startswith("SELECT"):
            statements.append(statement)

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", _capture)
    try:
        response = client.get(f"{ENDPOINT}/{employee_id}/details")
    finally:
        event.remove(engine, "before_cursor_execute", _capture)

    assert response.status_code == 200
    assert len(statements) == 1
    assert "JOIN" in statements[0].upper()
