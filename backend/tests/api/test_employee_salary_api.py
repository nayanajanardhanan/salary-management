from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models.employee import Employee
from app.models.salary import Salary
from app.schemas.salary import SalaryCreate, SalaryUpdate
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


# --- PUT /{employee_id}/salary ---------------------------------------------


def _seed_employee_with_salary(
    db_session: Session, index: int = 1, *, amount: str = "1000.00", currency: str = "USD"
) -> Employee:
    employee = _employee(index)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal(amount), currency=currency))
    db_session.commit()
    return employee


def test_update_employee_salary_returns_200(client: TestClient, db_session: Session) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "2000.00", "currency": "EUR"}
    )

    assert response.status_code == 200
    assert response.json() == {"employee_id": employee.id, "amount": "2000.00", "currency": "EUR"}


def test_update_employee_salary_persists_new_values(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    client.put(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "5000.50", "currency": "GBP"})

    persisted = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one()
    assert persisted.amount == Decimal("5000.50")
    assert persisted.currency == "GBP"


def test_update_employee_salary_does_not_create_a_second_row(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    client.put(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "5000.50", "currency": "GBP"})

    count = db_session.scalar(
        select(func.count()).select_from(Salary).where(Salary.employee_id == employee.id)
    )
    assert count == 1


def test_update_employee_salary_response_fields(client: TestClient, db_session: Session) -> None:
    employee = _seed_employee_with_salary(db_session)

    body = client.put(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "2000.00", "currency": "EUR"}
    ).json()

    assert set(body.keys()) == {"employee_id", "amount", "currency"}


def test_update_employee_salary_updates_calculated_summary_values(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session, amount="1000.00", currency="USD")

    client.put(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "8000.00", "currency": "JPY"})

    summary = client.get(f"{ENDPOINT}/{employee.id}/salary/summary").json()
    assert summary["amount"] == "8000.00"
    assert summary["currency"] == "JPY"
    assert summary["calculated"] == {
        "total": "8000.00",
        "average": "8000.00",
        "minimum": "8000.00",
        "maximum": "8000.00",
    }


def test_update_employee_salary_allows_zero_amount(client: TestClient, db_session: Session) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "0.00", "currency": "USD"}
    )

    assert response.status_code == 200
    assert response.json()["amount"] == "0.00"


def test_update_employee_salary_missing_amount_returns_422(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(f"{ENDPOINT}/{employee.id}/salary", json={"currency": "USD"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_update_employee_salary_missing_currency_returns_422(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "1000"})

    assert response.status_code == 422


def test_update_employee_salary_rejects_negative_amount(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "-1.00", "currency": "USD"}
    )

    assert response.status_code == 422


def test_update_employee_salary_rejects_non_numeric_amount(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "not-a-number", "currency": "USD"}
    )

    assert response.status_code == 422


def test_update_employee_salary_rejects_excess_decimal_places(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "100.999", "currency": "USD"}
    )

    assert response.status_code == 422


@pytest.mark.parametrize("currency", ["US", "USDD", "usd", "U5D", ""])
def test_update_employee_salary_rejects_invalid_currency(
    client: TestClient, db_session: Session, currency: str
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "1000", "currency": currency}
    )

    assert response.status_code == 422


def test_update_employee_salary_rejects_employee_id_in_body(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary",
        json={"amount": "2000.00", "currency": "EUR", "employee_id": 999999},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert any("employee_id" in detail["location"] for detail in body["error"]["details"])


def test_update_employee_salary_rejects_id_in_body(client: TestClient, db_session: Session) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary",
        json={"amount": "2000.00", "currency": "EUR", "id": 999999},
    )

    assert response.status_code == 422


def test_update_employee_salary_does_not_actually_reassign_employee_id(
    client: TestClient, db_session: Session
) -> None:
    """Even ignoring the `extra="forbid"` rejection above: confirm there is
    no code path that lets the body's `employee_id` override the path's."""
    employee = _seed_employee_with_salary(db_session)

    salary_service.update_salary(
        db_session, employee.id, SalaryUpdate(amount=Decimal("3000.00"), currency="USD")
    )

    persisted = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one()
    assert persisted.employee_id == employee.id


def test_update_employee_salary_rejects_non_integer_employee_id(
    client: TestClient, db_session: Session
) -> None:
    response = client.put(
        f"{ENDPOINT}/not-a-number/salary", json={"amount": "1000", "currency": "USD"}
    )

    assert response.status_code == 422


def test_update_employee_salary_for_nonexistent_employee_returns_404(
    client: TestClient, db_session: Session
) -> None:
    response = client.put(
        f"{ENDPOINT}/999999/salary", json={"amount": "1000", "currency": "USD"}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_update_employee_salary_for_employee_without_salary_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.put(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "1000.00", "currency": "USD"}
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SALARY_NOT_FOUND"


def test_update_employee_salary_for_employee_without_salary_does_not_create_one(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    client.put(f"{ENDPOINT}/{employee.id}/salary", json={"amount": "1000.00", "currency": "USD"})

    count = db_session.scalar(
        select(func.count()).select_from(Salary).where(Salary.employee_id == employee.id)
    )
    assert count == 0


def test_update_salary_service_raises_not_found_for_missing_salary(
    db_session: Session,
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    with pytest.raises(NotFoundError):
        salary_service.update_salary(
            db_session, employee.id, SalaryUpdate(amount=Decimal("1000.00"), currency="USD")
        )


def test_update_salary_service_rolls_back_on_persistence_failure(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    employee = _seed_employee_with_salary(db_session, amount="1000.00", currency="USD")

    def _boom() -> None:
        raise RuntimeError("simulated persistence failure")

    monkeypatch.setattr(db_session, "commit", _boom)

    with pytest.raises(RuntimeError):
        salary_service.update_salary(
            db_session, employee.id, SalaryUpdate(amount=Decimal("9999.00"), currency="JPY")
        )

    # `session.rollback()` inside `update_salary` must both revert the
    # transaction and leave the session usable for the query below (rather
    # than leaving it in a broken, "pending rollback" state).
    persisted = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one()
    assert persisted.amount == Decimal("1000.00")
    assert persisted.currency == "USD"


# --- DELETE /{employee_id}/salary ------------------------------------------


def test_delete_employee_salary_returns_204(client: TestClient, db_session: Session) -> None:
    employee = _seed_employee_with_salary(db_session)

    response = client.delete(f"{ENDPOINT}/{employee.id}/salary")

    assert response.status_code == 204
    assert response.content == b""


def test_delete_employee_salary_removes_it_from_the_database(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    client.delete(f"{ENDPOINT}/{employee.id}/salary")

    remaining = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one_or_none()
    assert remaining is None


def test_delete_employee_salary_subsequent_get_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    client.delete(f"{ENDPOINT}/{employee.id}/salary")
    response = client.get(f"{ENDPOINT}/{employee.id}/salary")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SALARY_NOT_FOUND"


def test_delete_employee_salary_subsequent_summary_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    client.delete(f"{ENDPOINT}/{employee.id}/salary")
    response = client.get(f"{ENDPOINT}/{employee.id}/salary/summary")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SALARY_NOT_FOUND"


def test_delete_employee_salary_allows_recreating_afterward(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    client.delete(f"{ENDPOINT}/{employee.id}/salary")
    response = client.post(
        f"{ENDPOINT}/{employee.id}/salary", json={"amount": "3000.00", "currency": "EUR"}
    )

    assert response.status_code == 201
    assert response.json()["amount"] == "3000.00"


def test_delete_employee_salary_does_not_delete_the_employee(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    client.delete(f"{ENDPOINT}/{employee.id}/salary")
    response = client.get(f"{ENDPOINT}/{employee.id}")

    assert response.status_code == 200
    assert response.json()["id"] == employee.id


def test_delete_employee_salary_leaves_unrelated_records_intact(
    client: TestClient, db_session: Session
) -> None:
    target = _seed_employee_with_salary(db_session, index=1, amount="1000.00", currency="USD")
    other = _seed_employee_with_salary(db_session, index=2, amount="2000.00", currency="GBP")

    client.delete(f"{ENDPOINT}/{target.id}/salary")

    other_salary = db_session.execute(
        select(Salary).where(Salary.employee_id == other.id)
    ).scalar_one()
    assert other_salary.amount == Decimal("2000.00")
    assert other_salary.currency == "GBP"

    other_employee_response = client.get(f"{ENDPOINT}/{other.id}")
    assert other_employee_response.status_code == 200


def test_delete_employee_salary_rejects_non_integer_employee_id(
    client: TestClient, db_session: Session
) -> None:
    response = client.delete(f"{ENDPOINT}/not-a-number/salary")

    assert response.status_code == 422


def test_delete_employee_salary_for_nonexistent_employee_returns_404(
    client: TestClient, db_session: Session
) -> None:
    response = client.delete(f"{ENDPOINT}/999999/salary")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_delete_employee_salary_for_employee_without_salary_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.delete(f"{ENDPOINT}/{employee.id}/salary")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SALARY_NOT_FOUND"


def test_delete_employee_salary_twice_returns_404_on_second_attempt(
    client: TestClient, db_session: Session
) -> None:
    employee = _seed_employee_with_salary(db_session)

    first = client.delete(f"{ENDPOINT}/{employee.id}/salary")
    second = client.delete(f"{ENDPOINT}/{employee.id}/salary")

    assert first.status_code == 204
    assert second.status_code == 404
    assert second.json()["error"]["code"] == "SALARY_NOT_FOUND"


def test_delete_salary_service_raises_not_found_for_missing_salary(
    db_session: Session,
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    with pytest.raises(NotFoundError):
        salary_service.delete_salary(db_session, employee.id)


def test_delete_salary_service_rolls_back_on_persistence_failure(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    employee = _seed_employee_with_salary(db_session, amount="1000.00", currency="USD")

    def _boom() -> None:
        raise RuntimeError("simulated persistence failure")

    monkeypatch.setattr(db_session, "commit", _boom)

    with pytest.raises(RuntimeError):
        salary_service.delete_salary(db_session, employee.id)

    # `session.rollback()` inside `delete_salary` must both revert the
    # pending delete and leave the session usable for the query below.
    persisted = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one()
    assert persisted.amount == Decimal("1000.00")
    assert persisted.currency == "USD"
