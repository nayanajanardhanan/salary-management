from decimal import Decimal

from fastapi.testclient import TestClient
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


def test_get_employee_salary_returns_existing_salary(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("95000.00"), currency="GBP"))
    db_session.commit()

    response = client.get(f"{ENDPOINT}/{employee.id}/salary")

    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == "95000.00"
    assert body["currency"] == "GBP"


def test_get_employee_salary_response_fields(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1234.56"), currency="USD"))
    db_session.commit()

    body = client.get(f"{ENDPOINT}/{employee.id}/salary").json()

    assert set(body.keys()) == {"employee_id", "amount", "currency"}


def test_get_employee_salary_is_associated_with_correct_employee(
    client: TestClient, db_session: Session
) -> None:
    employee_1 = _employee(1)
    employee_2 = _employee(2)
    db_session.add_all([employee_1, employee_2])
    db_session.flush()
    db_session.add_all(
        [
            Salary(employee_id=employee_1.id, amount=Decimal("1000.00"), currency="USD"),
            Salary(employee_id=employee_2.id, amount=Decimal("2000.00"), currency="EUR"),
        ]
    )
    db_session.commit()

    response = client.get(f"{ENDPOINT}/{employee_2.id}/salary")

    body = response.json()
    assert body["employee_id"] == employee_2.id
    assert body["amount"] == "2000.00"
    assert body["currency"] == "EUR"


def test_get_employee_salary_handles_decimal_precision(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("100000.10"), currency="USD"))
    db_session.commit()

    body = client.get(f"{ENDPOINT}/{employee.id}/salary").json()

    assert Decimal(body["amount"]) == Decimal("100000.10")


def test_get_employee_salary_for_nonexistent_employee_returns_404(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(f"{ENDPOINT}/999999/salary")

    assert response.status_code == 404
    assert "detail" in response.json()


def test_get_employee_salary_for_employee_without_salary_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.get(f"{ENDPOINT}/{employee.id}/salary")

    assert response.status_code == 404
    assert "detail" in response.json()


def test_get_employee_salary_rejects_non_integer_id(client: TestClient, db_session: Session) -> None:
    response = client.get(f"{ENDPOINT}/not-a-number/salary")

    assert response.status_code == 422
