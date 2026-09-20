from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.salary import Salary
from app.schemas.salary import SalaryCreate
from app.services import salary_service

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
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_get_employee_salary_for_employee_without_salary_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.get(f"{ENDPOINT}/{employee.id}/salary")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SALARY_NOT_FOUND"


def test_get_employee_salary_rejects_non_integer_id(client: TestClient, db_session: Session) -> None:
    response = client.get(f"{ENDPOINT}/not-a-number/salary")

    assert response.status_code == 422


def test_get_employee_salary_summary_returns_original_and_calculated_values(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("95000.00"), currency="GBP"))
    db_session.commit()

    response = client.get(f"{ENDPOINT}/{employee.id}/salary/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["employee_id"] == employee.id
    assert body["amount"] == "95000.00"
    assert body["currency"] == "GBP"
    assert body["calculated"] == {
        "total": "95000.00",
        "average": "95000.00",
        "minimum": "95000.00",
        "maximum": "95000.00",
    }


def test_get_employee_salary_summary_response_fields(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1234.56"), currency="USD"))
    db_session.commit()

    body = client.get(f"{ENDPOINT}/{employee.id}/salary/summary").json()

    assert set(body.keys()) == {"employee_id", "amount", "currency", "calculated"}
    assert set(body["calculated"].keys()) == {"total", "average", "minimum", "maximum"}


def test_get_employee_salary_summary_is_associated_with_correct_employee(
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

    response = client.get(f"{ENDPOINT}/{employee_2.id}/salary/summary")

    body = response.json()
    assert body["employee_id"] == employee_2.id
    assert body["amount"] == "2000.00"
    assert body["calculated"]["total"] == "2000.00"


def test_get_employee_salary_summary_handles_decimal_precision(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("100000.10"), currency="USD"))
    db_session.commit()

    body = client.get(f"{ENDPOINT}/{employee.id}/salary/summary").json()

    for field in ("total", "average", "minimum", "maximum"):
        assert Decimal(body["calculated"][field]) == Decimal("100000.10")


def test_get_employee_salary_summary_handles_zero_valued_salary(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("0.00"), currency="USD"))
    db_session.commit()

    body = client.get(f"{ENDPOINT}/{employee.id}/salary/summary").json()

    assert body["amount"] == "0.00"
    assert all(Decimal(value) == Decimal("0") for value in body["calculated"].values())


def test_get_employee_salary_summary_for_nonexistent_employee_returns_404(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(f"{ENDPOINT}/999999/salary/summary")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_get_employee_salary_summary_for_employee_without_salary_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.get(f"{ENDPOINT}/{employee.id}/salary/summary")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SALARY_NOT_FOUND"


def test_get_employee_salary_summary_rejects_non_integer_id(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(f"{ENDPOINT}/not-a-number/salary/summary")

    assert response.status_code == 422


# --- POST /{employee_id}/salary --------------------------------------------


def test_create_employee_salary_returns_201(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "95000.00", "currency": "GBP"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body == {"employee_id": employee.id, "amount": "95000.00", "currency": "GBP"}


def test_create_employee_salary_persists_the_record(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    client.post(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "50000.00", "currency": "USD"})

    persisted = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one()
    assert persisted.amount == Decimal("50000.00")
    assert persisted.currency == "USD"


def test_create_employee_salary_response_fields(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    body = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "1234.56", "currency": "USD"}
    ).json()

    assert set(body.keys()) == {"employee_id", "amount", "currency"}


def test_create_employee_salary_allows_zero_amount(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "0.00", "currency": "USD"}
    )

    assert response.status_code == 201
    assert response.json()["amount"] == "0.00"


def test_create_employee_salary_missing_amount_returns_422(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.post(f"{ENDPOINT}/{employee.id}/salary", json={"currency": "USD"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_employee_salary_missing_currency_returns_422(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.post(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "1000"})

    assert response.status_code == 422


def test_create_employee_salary_rejects_negative_amount(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "-1.00", "currency": "USD"}
    )

    assert response.status_code == 422


def test_create_employee_salary_rejects_non_numeric_amount(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "not-a-number", "currency": "USD"}
    )

    assert response.status_code == 422


def test_create_employee_salary_rejects_excess_decimal_places(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "100.999", "currency": "USD"}
    )

    assert response.status_code == 422


@pytest.mark.parametrize("currency", ["US", "USDD", "usd", "U5D", ""])
def test_create_employee_salary_rejects_invalid_currency(
    client: TestClient, db_session: Session, currency: str
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "1000", "currency": currency}
    )

    assert response.status_code == 422


def test_create_employee_salary_rejects_non_integer_employee_id(
    client: TestClient, db_session: Session
) -> None:
    response = client.post(
        f"{ENDPOINT}/not-a-number/salary", json={"amount": "1000", "currency": "USD"}
    )

    assert response.status_code == 422


def test_create_employee_salary_for_nonexistent_employee_returns_404(
    client: TestClient, db_session: Session
) -> None:
    response = client.post(
        f"{ENDPOINT}/999999/salary", json={"amount": "1000", "currency": "USD"}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_create_employee_salary_for_nonexistent_employee_does_not_persist(
    client: TestClient, db_session: Session
) -> None:
    client.post(f"{ENDPOINT}/999999/salary", json={"amount": "1000", "currency": "USD"})

    count = db_session.scalar(select(func.count()).select_from(Salary))
    assert count == 0


def test_create_employee_salary_duplicate_returns_409(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000"), currency="USD"))
    db_session.commit()

    response = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "2000.00", "currency": "EUR"}
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SALARY_ALREADY_EXISTS"


def test_create_employee_salary_duplicate_does_not_modify_existing_record(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    client.post(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "2000.00", "currency": "EUR"})

    persisted = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one()
    assert persisted.amount == Decimal("1000.00")
    assert persisted.currency == "USD"


def test_create_employee_salary_duplicate_leaves_only_one_row(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    client.post(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "2000.00", "currency": "EUR"})

    count = db_session.scalar(
        select(func.count()).select_from(Salary).where(Salary.employee_id == employee.id)
    )
    assert count == 1


def test_create_salary_service_rolls_back_and_raises_conflict_on_race(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A concurrent request could insert a salary after this call's own
    pre-check already found none; the database's unique constraint is the
    final guard for that race, and `create_salary` must translate the
    resulting `IntegrityError` into `ConflictError` without leaving the
    session broken or the table with more than one row for the employee."""
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    # Force the "no existing salary" branch despite one already existing,
    # simulating a request that raced past the pre-check.
    monkeypatch.setattr(salary_service, "get_salary_for_employee", lambda session, eid: None)

    from app.core.errors import ConflictError

    with pytest.raises(ConflictError):
        salary_service.create_salary(
            db_session, employee.id, SalaryCreate(amount=Decimal("2000.00"), currency="EUR")
        )

    count = db_session.scalar(
        select(func.count()).select_from(Salary).where(Salary.employee_id == employee.id)
    )
    assert count == 1
    # The session must still be usable after the rollback.
    assert db_session.scalar(select(func.count()).select_from(Employee)) == 1
