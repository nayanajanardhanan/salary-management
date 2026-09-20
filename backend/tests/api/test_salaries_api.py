from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.salary import Salary
from app.utils.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

ENDPOINT = "/api/v1/salaries"


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


def _seed_salaries(
    db_session: Session, count: int, *, amount_start: int = 1000, currency: str = "USD", **employee_overrides
) -> list[Salary]:
    employees = [_employee(i, **employee_overrides) for i in range(1, count + 1)]
    db_session.add_all(employees)
    db_session.flush()

    salaries = [
        Salary(employee_id=employee.id, amount=Decimal(amount_start + i * 100), currency=currency)
        for i, employee in enumerate(employees)
    ]
    db_session.add_all(salaries)
    db_session.commit()
    return salaries


def test_list_salaries_returns_seeded_records(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 3)

    response = client.get(ENDPOINT)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert [item["amount"] for item in body["items"]] == ["1000.00", "1100.00", "1200.00"]


def test_list_salaries_response_structure(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 1)

    body = client.get(ENDPOINT).json()

    assert set(body.keys()) == {"items", "page", "page_size", "total", "has_next"}
    assert set(body["items"][0].keys()) == {"employee_id", "amount", "currency"}


def test_list_salaries_empty_database(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT)

    assert response.status_code == 200
    body = response.json()
    assert body == {"items": [], "page": 1, "page_size": DEFAULT_PAGE_SIZE, "total": 0, "has_next": False}


def test_list_salaries_default_pagination(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 5)

    response = client.get(ENDPOINT)

    body = response.json()
    assert body["page"] == 1
    assert body["page_size"] == DEFAULT_PAGE_SIZE
    assert len(body["items"]) == 5
    assert body["has_next"] is False


def test_list_salaries_custom_page_size(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 10)

    response = client.get(ENDPOINT, params={"page_size": 4})

    body = response.json()
    assert body["page_size"] == 4
    assert len(body["items"]) == 4
    assert body["total"] == 10
    assert body["has_next"] is True


def test_list_salaries_later_page(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 10)

    response = client.get(ENDPOINT, params={"page": 2, "page_size": 4})

    body = response.json()
    assert body["page"] == 2
    assert [item["amount"] for item in body["items"]] == ["1400.00", "1500.00", "1600.00", "1700.00"]
    assert body["has_next"] is True


def test_list_salaries_rejects_page_size_above_maximum(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"page_size": MAX_PAGE_SIZE + 1})

    assert response.status_code == 422


def test_list_salaries_filter_by_employee_id(client: TestClient, db_session: Session) -> None:
    salaries = _seed_salaries(db_session, 3)
    target = salaries[1]

    response = client.get(ENDPOINT, params={"employee_id": target.employee_id})

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["employee_id"] == target.employee_id
    assert body["items"][0]["amount"] == "1100.00"


def test_list_salaries_filter_by_employee_id_with_no_match(
    client: TestClient, db_session: Session
) -> None:
    _seed_salaries(db_session, 3)

    response = client.get(ENDPOINT, params={"employee_id": 999999})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_list_salaries_filter_by_currency(client: TestClient, db_session: Session) -> None:
    employee_usd = _employee(1)
    employee_gbp = _employee(2)
    db_session.add_all([employee_usd, employee_gbp])
    db_session.flush()
    db_session.add_all(
        [
            Salary(employee_id=employee_usd.id, amount=Decimal("1000"), currency="USD"),
            Salary(employee_id=employee_gbp.id, amount=Decimal("2000"), currency="GBP"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"currency": "GBP"})

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["currency"] == "GBP"


def test_list_salaries_filter_by_min_amount(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 5)  # amounts: 1000, 1100, 1200, 1300, 1400

    response = client.get(ENDPOINT, params={"min_amount": "1200"})

    body = response.json()
    assert [item["amount"] for item in body["items"]] == ["1200.00", "1300.00", "1400.00"]


def test_list_salaries_filter_by_max_amount(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 5)  # amounts: 1000, 1100, 1200, 1300, 1400

    response = client.get(ENDPOINT, params={"max_amount": "1200"})

    body = response.json()
    assert [item["amount"] for item in body["items"]] == ["1000.00", "1100.00", "1200.00"]


def test_list_salaries_filter_by_min_and_max_amount(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 5)  # amounts: 1000, 1100, 1200, 1300, 1400

    response = client.get(ENDPOINT, params={"min_amount": "1100", "max_amount": "1300"})

    body = response.json()
    assert [item["amount"] for item in body["items"]] == ["1100.00", "1200.00", "1300.00"]


def test_list_salaries_min_amount_above_max_amount_returns_empty(
    client: TestClient, db_session: Session
) -> None:
    _seed_salaries(db_session, 5)

    response = client.get(ENDPOINT, params={"min_amount": "1400", "max_amount": "1000"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_list_salaries_rejects_negative_min_amount(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"min_amount": "-1"})

    assert response.status_code == 422


def test_list_salaries_rejects_negative_max_amount(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"max_amount": "-1"})

    assert response.status_code == 422


def test_list_salaries_rejects_non_numeric_min_amount(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"min_amount": "not-a-number"})

    assert response.status_code == 422


def test_list_salaries_filter_by_department(client: TestClient, db_session: Session) -> None:
    employee_eng = _employee(1, department="Engineering")
    employee_sales = _employee(2, department="Sales")
    db_session.add_all([employee_eng, employee_sales])
    db_session.flush()
    db_session.add_all(
        [
            Salary(employee_id=employee_eng.id, amount=Decimal("1000"), currency="USD"),
            Salary(employee_id=employee_sales.id, amount=Decimal("2000"), currency="USD"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"department": "Sales"})

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["employee_id"] == employee_sales.id


def test_list_salaries_filter_by_country(client: TestClient, db_session: Session) -> None:
    employee_uk = _employee(1, country="UK")
    employee_india = _employee(2, country="India")
    db_session.add_all([employee_uk, employee_india])
    db_session.flush()
    db_session.add_all(
        [
            Salary(employee_id=employee_uk.id, amount=Decimal("1000"), currency="GBP"),
            Salary(employee_id=employee_india.id, amount=Decimal("2000"), currency="INR"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"country": "India"})

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["employee_id"] == employee_india.id


def test_list_salaries_combines_multiple_filters(client: TestClient, db_session: Session) -> None:
    employees = [
        _employee(1, department="Engineering", country="UK"),
        _employee(2, department="Engineering", country="India"),
        _employee(3, department="Sales", country="UK"),
    ]
    db_session.add_all(employees)
    db_session.flush()
    db_session.add_all(
        [
            Salary(employee_id=employees[0].id, amount=Decimal("1000"), currency="GBP"),
            Salary(employee_id=employees[1].id, amount=Decimal("2000"), currency="INR"),
            Salary(employee_id=employees[2].id, amount=Decimal("3000"), currency="GBP"),
        ]
    )
    db_session.commit()

    response = client.get(
        ENDPOINT, params={"department": "Engineering", "country": "UK", "min_amount": "500"}
    )

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["employee_id"] == employees[0].id


def test_list_salaries_no_duplicate_rows_from_employee_join(
    client: TestClient, db_session: Session
) -> None:
    _seed_salaries(db_session, 4, department="Engineering")

    response = client.get(ENDPOINT, params={"department": "Engineering"})

    body = response.json()
    assert body["total"] == 4
    assert len(body["items"]) == 4


def test_list_salaries_sort_by_amount_ascending(client: TestClient, db_session: Session) -> None:
    employees = [_employee(1), _employee(2), _employee(3)]
    db_session.add_all(employees)
    db_session.flush()
    db_session.add_all(
        [
            Salary(employee_id=employees[0].id, amount=Decimal("3000"), currency="USD"),
            Salary(employee_id=employees[1].id, amount=Decimal("1000"), currency="USD"),
            Salary(employee_id=employees[2].id, amount=Decimal("2000"), currency="USD"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"sort_by": "amount", "sort_order": "asc"})

    assert [item["amount"] for item in response.json()["items"]] == ["1000.00", "2000.00", "3000.00"]


def test_list_salaries_sort_by_amount_descending(client: TestClient, db_session: Session) -> None:
    employees = [_employee(1), _employee(2), _employee(3)]
    db_session.add_all(employees)
    db_session.flush()
    db_session.add_all(
        [
            Salary(employee_id=employees[0].id, amount=Decimal("3000"), currency="USD"),
            Salary(employee_id=employees[1].id, amount=Decimal("1000"), currency="USD"),
            Salary(employee_id=employees[2].id, amount=Decimal("2000"), currency="USD"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"sort_by": "amount", "sort_order": "desc"})

    assert [item["amount"] for item in response.json()["items"]] == ["3000.00", "2000.00", "1000.00"]


@pytest.mark.parametrize("field", ["employee_id", "currency"])
def test_list_salaries_sort_by_each_supported_field(
    client: TestClient, db_session: Session, field: str
) -> None:
    _seed_salaries(db_session, 3)

    response = client.get(ENDPOINT, params={"sort_by": field, "sort_order": "asc"})

    assert response.status_code == 200
    returned = [item[field] for item in response.json()["items"]]
    assert returned == sorted(returned)


def test_list_salaries_rejects_unsupported_sort_field(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"sort_by": "employee_code"})

    assert response.status_code == 422


def test_list_salaries_rejects_invalid_sort_order(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"sort_by": "amount", "sort_order": "sideways"})

    assert response.status_code == 422


def test_list_salaries_sort_combined_with_pagination(client: TestClient, db_session: Session) -> None:
    _seed_salaries(db_session, 10)  # amounts: 1000..1900 ascending by employee id

    response = client.get(
        ENDPOINT, params={"sort_by": "amount", "sort_order": "desc", "page": 2, "page_size": 3}
    )

    body = response.json()
    assert body["total"] == 10
    assert [item["amount"] for item in body["items"]] == ["1600.00", "1500.00", "1400.00"]


def test_list_salaries_filter_with_no_matches_returns_empty_page(
    client: TestClient, db_session: Session
) -> None:
    _seed_salaries(db_session, 5, currency="USD")

    response = client.get(ENDPOINT, params={"currency": "JPY"})

    assert response.status_code == 200
    body = response.json()
    assert body == {"items": [], "page": 1, "page_size": DEFAULT_PAGE_SIZE, "total": 0, "has_next": False}


def test_list_salaries_sort_is_stable_for_equal_values(client: TestClient, db_session: Session) -> None:
    employees = [_employee(1), _employee(2), _employee(3)]
    db_session.add_all(employees)
    db_session.flush()
    db_session.add_all(
        [Salary(employee_id=employee.id, amount=Decimal("1000"), currency="USD") for employee in employees]
    )
    db_session.commit()

    first_response = client.get(ENDPOINT, params={"sort_by": "amount", "sort_order": "asc"}).json()
    second_response = client.get(ENDPOINT, params={"sort_by": "amount", "sort_order": "asc"}).json()

    assert first_response == second_response
    assert [item["employee_id"] for item in first_response["items"]] == [e.id for e in employees]


def test_list_salaries_decimal_serialization_preserves_precision(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("123456.78"), currency="USD"))
    db_session.commit()

    body = client.get(ENDPOINT).json()

    assert body["items"][0]["amount"] == "123456.78"
    assert Decimal(body["items"][0]["amount"]) == Decimal("123456.78")
