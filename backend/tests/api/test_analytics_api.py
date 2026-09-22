from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.salary import Salary

ENDPOINT = "/api/v1/analytics/salary"


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


def _add_employee_with_salary(
    db_session: Session, index: int, *, amount: str, currency: str = "USD", **employee_overrides
) -> Employee:
    employee = _employee(index, **employee_overrides)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal(amount), currency=currency))
    return employee


def _find(entries: list[dict], **key) -> dict:
    matches = [entry for entry in entries if all(entry[k] == v for k, v in key.items())]
    assert len(matches) == 1, f"expected exactly one match for {key} in {entries}"
    return matches[0]


def test_salary_statistics_empty_dataset_returns_empty_lists(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(ENDPOINT)

    assert response.status_code == 200
    assert response.json() == {"overall": [], "by_department": [], "by_country": []}


def test_salary_statistics_overall_count(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000")
    _add_employee_with_salary(db_session, 2, amount="2000")
    _add_employee_with_salary(db_session, 3, amount="3000")
    db_session.commit()

    body = client.get(ENDPOINT).json()

    usd = _find(body["overall"], currency="USD")
    assert usd["count"] == 3


def test_salary_statistics_overall_average(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000")
    _add_employee_with_salary(db_session, 2, amount="2000")
    _add_employee_with_salary(db_session, 3, amount="3000")
    db_session.commit()

    body = client.get(ENDPOINT).json()

    usd = _find(body["overall"], currency="USD")
    assert Decimal(usd["average"]) == Decimal("2000")


def test_salary_statistics_overall_min_and_max(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000")
    _add_employee_with_salary(db_session, 2, amount="2000")
    _add_employee_with_salary(db_session, 3, amount="3000")
    db_session.commit()

    body = client.get(ENDPOINT).json()

    usd = _find(body["overall"], currency="USD")
    assert Decimal(usd["minimum"]) == Decimal("1000")
    assert Decimal(usd["maximum"]) == Decimal("3000")


def test_salary_statistics_average_uses_exact_decimal_division(
    client: TestClient, db_session: Session
) -> None:
    # 10 / 3 is not exact in binary floating point; must stay exact via Decimal.
    _add_employee_with_salary(db_session, 1, amount="10.00")
    _add_employee_with_salary(db_session, 2, amount="20.00")
    _add_employee_with_salary(db_session, 3, amount="20.00")
    db_session.commit()

    body = client.get(ENDPOINT).json()

    usd = _find(body["overall"], currency="USD")
    assert Decimal(usd["average"]) == Decimal(50) / Decimal(3)


def test_salary_statistics_response_fields(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000", department="Engineering", country="UK")
    db_session.commit()

    body = client.get(ENDPOINT).json()

    assert set(body.keys()) == {"overall", "by_department", "by_country"}
    assert set(body["overall"][0].keys()) == {"currency", "count", "average", "minimum", "maximum"}
    assert set(body["by_department"][0].keys()) == {
        "currency",
        "count",
        "average",
        "minimum",
        "maximum",
        "department",
    }
    assert set(body["by_country"][0].keys()) == {
        "currency",
        "count",
        "average",
        "minimum",
        "maximum",
        "country",
    }


def test_salary_statistics_never_combines_currencies(
    client: TestClient, db_session: Session
) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000", currency="USD")
    _add_employee_with_salary(db_session, 2, amount="500000", currency="INR")
    db_session.commit()

    body = client.get(ENDPOINT).json()

    assert len(body["overall"]) == 2
    usd = _find(body["overall"], currency="USD")
    inr = _find(body["overall"], currency="INR")
    assert Decimal(usd["average"]) == Decimal("1000")
    assert Decimal(inr["average"]) == Decimal("500000")


def test_salary_statistics_by_department(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000", department="Engineering")
    _add_employee_with_salary(db_session, 2, amount="3000", department="Engineering")
    _add_employee_with_salary(db_session, 3, amount="5000", department="Sales")
    db_session.commit()

    body = client.get(ENDPOINT).json()

    engineering = _find(body["by_department"], department="Engineering", currency="USD")
    sales = _find(body["by_department"], department="Sales", currency="USD")
    assert engineering["count"] == 2
    assert Decimal(engineering["average"]) == Decimal("2000")
    assert sales["count"] == 1
    assert Decimal(sales["average"]) == Decimal("5000")


def test_salary_statistics_by_country(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000", country="UK")
    _add_employee_with_salary(db_session, 2, amount="3000", country="UK")
    _add_employee_with_salary(db_session, 3, amount="5000", country="India")
    db_session.commit()

    body = client.get(ENDPOINT).json()

    uk = _find(body["by_country"], country="UK", currency="USD")
    india = _find(body["by_country"], country="India", currency="USD")
    assert uk["count"] == 2
    assert Decimal(uk["average"]) == Decimal("2000")
    assert india["count"] == 1


def test_salary_statistics_department_split_by_currency(
    client: TestClient, db_session: Session
) -> None:
    _add_employee_with_salary(
        db_session, 1, amount="1000", currency="USD", department="Engineering", country="US"
    )
    _add_employee_with_salary(
        db_session, 2, amount="500000", currency="INR", department="Engineering", country="India"
    )
    db_session.commit()

    body = client.get(ENDPOINT).json()

    engineering_entries = [e for e in body["by_department"] if e["department"] == "Engineering"]
    assert len(engineering_entries) == 2
    currencies = {e["currency"] for e in engineering_entries}
    assert currencies == {"USD", "INR"}


def test_salary_statistics_excludes_department_with_no_salaries(
    client: TestClient, db_session: Session
) -> None:
    # An employee with no salary record contributes nothing to any group.
    employee = _employee(1, department="Marketing")
    db_session.add(employee)
    db_session.commit()

    body = client.get(ENDPOINT).json()

    assert body["by_department"] == []
    assert body["overall"] == []


def test_salary_statistics_filter_by_department(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000", department="Engineering")
    _add_employee_with_salary(db_session, 2, amount="5000", department="Sales")
    db_session.commit()

    body = client.get(ENDPOINT, params={"department": "Sales"}).json()

    usd = _find(body["overall"], currency="USD")
    assert usd["count"] == 1
    assert Decimal(usd["average"]) == Decimal("5000")
    assert [e["department"] for e in body["by_department"]] == ["Sales"]


def test_salary_statistics_filter_by_country(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000", country="UK")
    _add_employee_with_salary(db_session, 2, amount="5000", country="India")
    db_session.commit()

    body = client.get(ENDPOINT, params={"country": "India"}).json()

    usd = _find(body["overall"], currency="USD")
    assert usd["count"] == 1
    assert Decimal(usd["average"]) == Decimal("5000")


def test_salary_statistics_filter_by_currency(client: TestClient, db_session: Session) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000", currency="USD")
    _add_employee_with_salary(db_session, 2, amount="500000", currency="INR")
    db_session.commit()

    body = client.get(ENDPOINT, params={"currency": "INR"}).json()

    assert len(body["overall"]) == 1
    assert body["overall"][0]["currency"] == "INR"


def test_salary_statistics_filter_by_min_and_max_amount(
    client: TestClient, db_session: Session
) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000")
    _add_employee_with_salary(db_session, 2, amount="2000")
    _add_employee_with_salary(db_session, 3, amount="3000")
    db_session.commit()

    body = client.get(ENDPOINT, params={"min_amount": "1500", "max_amount": "2500"}).json()

    usd = _find(body["overall"], currency="USD")
    assert usd["count"] == 1
    assert Decimal(usd["average"]) == Decimal("2000")


def test_salary_statistics_filters_apply_consistently_across_all_three_views(
    client: TestClient, db_session: Session
) -> None:
    _add_employee_with_salary(
        db_session, 1, amount="1000", department="Engineering", country="UK"
    )
    _add_employee_with_salary(db_session, 2, amount="5000", department="Sales", country="India")
    db_session.commit()

    body = client.get(ENDPOINT, params={"department": "Engineering"}).json()

    assert len(body["overall"]) == 1
    assert len(body["by_department"]) == 1
    assert body["by_department"][0]["department"] == "Engineering"
    assert len(body["by_country"]) == 1
    assert body["by_country"][0]["country"] == "UK"


def test_salary_statistics_filter_with_no_matches_returns_empty_lists(
    client: TestClient, db_session: Session
) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000", currency="USD")
    db_session.commit()

    body = client.get(ENDPOINT, params={"currency": "JPY"}).json()

    assert body == {"overall": [], "by_department": [], "by_country": []}


def test_salary_statistics_rejects_negative_min_amount(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(ENDPOINT, params={"min_amount": "-1"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_salary_statistics_rejects_non_numeric_min_amount(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(ENDPOINT, params={"min_amount": "not-a-number"})

    assert response.status_code == 422


@pytest.mark.parametrize("field", ["overall", "by_department", "by_country"])
def test_salary_statistics_min_amount_above_max_amount_returns_empty(
    client: TestClient, db_session: Session, field: str
) -> None:
    _add_employee_with_salary(db_session, 1, amount="1000")
    db_session.commit()

    body = client.get(ENDPOINT, params={"min_amount": "5000", "max_amount": "1000"}).json()

    assert body[field] == []
