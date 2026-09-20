from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models.employee import Employee
from app.models.salary import Salary
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.services import employee_service
from app.utils.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

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


def _employee_payload(index: int, **overrides) -> dict:
    payload = dict(
        employee_code=f"EMP-{index:03d}",
        first_name=f"First{index}",
        last_name=f"Last{index}",
        department="Engineering",
        country="UK",
        job_title="Software Engineer",
    )
    payload.update(overrides)
    return payload


def _seed_employees(db_session: Session, count: int) -> list[Employee]:
    employees = [_employee(i) for i in range(1, count + 1)]
    db_session.add_all(employees)
    db_session.commit()
    return employees


def test_list_employees_returns_seeded_records(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 3)

    response = client.get(ENDPOINT)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert [item["employee_code"] for item in body["items"]] == ["EMP-001", "EMP-002", "EMP-003"]


def test_list_employees_default_pagination(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 5)

    response = client.get(ENDPOINT)

    body = response.json()
    assert body["page"] == 1
    assert body["page_size"] == DEFAULT_PAGE_SIZE
    assert len(body["items"]) == 5
    assert body["has_next"] is False


def test_list_employees_custom_page_size(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 10)

    response = client.get(ENDPOINT, params={"page_size": 4})

    body = response.json()
    assert body["page_size"] == 4
    assert len(body["items"]) == 4
    assert body["total"] == 10
    assert body["has_next"] is True


def test_list_employees_later_page(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 10)

    response = client.get(ENDPOINT, params={"page": 2, "page_size": 4})

    body = response.json()
    assert body["page"] == 2
    assert [item["employee_code"] for item in body["items"]] == ["EMP-005", "EMP-006", "EMP-007", "EMP-008"]
    assert body["has_next"] is True


def test_list_employees_last_page_has_no_next(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 10)

    response = client.get(ENDPOINT, params={"page": 3, "page_size": 4})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-009", "EMP-010"]
    assert body["has_next"] is False


def test_list_employees_empty_database(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT)

    assert response.status_code == 200
    body = response.json()
    assert body == {"items": [], "page": 1, "page_size": DEFAULT_PAGE_SIZE, "total": 0, "has_next": False}


def test_list_employees_rejects_non_positive_page(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"page": 0})

    assert response.status_code == 422


def test_list_employees_rejects_non_positive_page_size(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"page_size": 0})

    assert response.status_code == 422


def test_list_employees_rejects_page_size_above_maximum(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"page_size": MAX_PAGE_SIZE + 1})

    assert response.status_code == 422


def test_list_employees_allows_page_size_at_maximum(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 3)

    response = client.get(ENDPOINT, params={"page_size": MAX_PAGE_SIZE})

    assert response.status_code == 200
    assert response.json()["page_size"] == MAX_PAGE_SIZE


def test_list_employees_response_structure(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 1)

    body = client.get(ENDPOINT).json()

    assert set(body.keys()) == {"items", "page", "page_size", "total", "has_next"}
    item = body["items"][0]
    assert set(item.keys()) == {
        "id",
        "employee_code",
        "first_name",
        "last_name",
        "department",
        "country",
        "job_title",
        "employment_status",
    }


def test_list_employees_search_matches_first_name(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, first_name="Margaret", last_name="Hamilton"),
            _employee(2, first_name="Ada", last_name="Lovelace"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"search": "Margaret"})

    body = response.json()
    assert body["total"] == 1
    assert [item["employee_code"] for item in body["items"]] == ["EMP-001"]


def test_list_employees_search_matches_last_name(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, first_name="Margaret", last_name="Hamilton"),
            _employee(2, first_name="Ada", last_name="Lovelace"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"search": "Lovelace"})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-002"]


def test_list_employees_search_matches_employee_code(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 3)

    response = client.get(ENDPOINT, params={"search": "EMP-002"})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-002"]


def test_list_employees_search_is_case_insensitive(client: TestClient, db_session: Session) -> None:
    db_session.add_all([_employee(1, first_name="Margaret", last_name="Hamilton")])
    db_session.commit()

    response = client.get(ENDPOINT, params={"search": "margaret"})

    assert response.json()["total"] == 1


def test_list_employees_search_matches_partial_substring(client: TestClient, db_session: Session) -> None:
    db_session.add_all([_employee(1, first_name="Margaret", last_name="Hamilton")])
    db_session.commit()

    response = client.get(ENDPOINT, params={"search": "garet"})

    assert response.json()["total"] == 1


def test_list_employees_blank_search_behaves_like_no_search(client: TestClient, db_session: Session) -> None:
    _seed_employees(db_session, 3)

    response = client.get(ENDPOINT, params={"search": "   "})

    assert response.json()["total"] == 3


def test_list_employees_filter_by_country(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, country="UK"),
            _employee(2, country="India"),
            _employee(3, country="UK"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"country": "India"})

    body = response.json()
    assert body["total"] == 1
    assert [item["employee_code"] for item in body["items"]] == ["EMP-002"]


def test_list_employees_filter_by_department(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, department="Engineering"),
            _employee(2, department="Sales"),
            _employee(3, department="Engineering"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"department": "Sales"})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-002"]


# --- FR-4.3: filtering employees by salary range -----------------------


def _employee_with_salary(
    db_session: Session, index: int, *, amount: str, currency: str = "USD", **overrides
) -> Employee:
    employee = _employee(index, **overrides)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal(amount), currency=currency))
    return employee


def test_list_employees_filter_by_min_salary(client: TestClient, db_session: Session) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00")
    _employee_with_salary(db_session, 2, amount="5000.00")
    db_session.commit()

    response = client.get(ENDPOINT, params={"min_salary": "2000"})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-002"]


def test_list_employees_filter_by_max_salary(client: TestClient, db_session: Session) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00")
    _employee_with_salary(db_session, 2, amount="5000.00")
    db_session.commit()

    response = client.get(ENDPOINT, params={"max_salary": "2000"})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-001"]


def test_list_employees_filter_by_salary_range(client: TestClient, db_session: Session) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00")
    _employee_with_salary(db_session, 2, amount="3000.00")
    _employee_with_salary(db_session, 3, amount="5000.00")
    db_session.commit()

    response = client.get(ENDPOINT, params={"min_salary": "2000", "max_salary": "4000"})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-002"]


def test_list_employees_salary_range_is_inclusive(client: TestClient, db_session: Session) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00")
    _employee_with_salary(db_session, 2, amount="2000.00")
    _employee_with_salary(db_session, 3, amount="3000.00")
    db_session.commit()

    response = client.get(ENDPOINT, params={"min_salary": "1000", "max_salary": "3000"})

    body = response.json()
    assert {item["employee_code"] for item in body["items"]} == {"EMP-001", "EMP-002", "EMP-003"}


def test_list_employees_filter_by_currency(client: TestClient, db_session: Session) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00", currency="USD")
    _employee_with_salary(db_session, 2, amount="1000.00", currency="GBP")
    db_session.commit()

    response = client.get(ENDPOINT, params={"currency": "GBP"})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-002"]


def test_list_employees_currency_filter_scopes_salary_range_to_one_currency(
    client: TestClient, db_session: Session
) -> None:
    # A raw numeric range spanning two currencies (e.g. 900-1100) would
    # otherwise match both a small GBP salary and a small INR salary,
    # which aren't comparable figures (docs/requirements.md Section 5) —
    # pairing `currency` with min/max scopes the range to one of them.
    _employee_with_salary(db_session, 1, amount="1000.00", currency="GBP")
    _employee_with_salary(db_session, 2, amount="1000.00", currency="INR")
    db_session.commit()

    response = client.get(
        ENDPOINT, params={"currency": "GBP", "min_salary": "900", "max_salary": "1100"}
    )

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-001"]


def test_list_employees_salary_filter_excludes_employees_without_salary(
    client: TestClient, db_session: Session
) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00")
    db_session.add(_employee(2))  # no salary record
    db_session.commit()

    response = client.get(ENDPOINT, params={"min_salary": "0"})

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-001"]


def test_list_employees_without_salary_filter_includes_employees_without_salary(
    client: TestClient, db_session: Session
) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00")
    db_session.add(_employee(2))  # no salary record
    db_session.commit()

    response = client.get(ENDPOINT)

    body = response.json()
    assert {item["employee_code"] for item in body["items"]} == {"EMP-001", "EMP-002"}


def test_list_employees_salary_filter_combined_with_department_filter(
    client: TestClient, db_session: Session
) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00", department="Engineering")
    _employee_with_salary(db_session, 2, amount="5000.00", department="Engineering")
    _employee_with_salary(db_session, 3, amount="5000.00", department="Sales")
    db_session.commit()

    response = client.get(
        ENDPOINT, params={"department": "Engineering", "min_salary": "2000"}
    )

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-002"]


def test_list_employees_salary_filter_with_no_matches_returns_empty_page(
    client: TestClient, db_session: Session
) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00")
    db_session.commit()

    response = client.get(ENDPOINT, params={"min_salary": "9999999"})

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_list_employees_rejects_negative_min_salary(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(ENDPOINT, params={"min_salary": "-1"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_list_employees_rejects_negative_max_salary(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(ENDPOINT, params={"max_salary": "-1"})

    assert response.status_code == 422


def test_list_employees_rejects_non_numeric_min_salary(
    client: TestClient, db_session: Session
) -> None:
    response = client.get(ENDPOINT, params={"min_salary": "not-a-number"})

    assert response.status_code == 422


def test_list_employees_min_salary_above_max_salary_returns_empty(
    client: TestClient, db_session: Session
) -> None:
    _employee_with_salary(db_session, 1, amount="1000.00")
    db_session.commit()

    response = client.get(ENDPOINT, params={"min_salary": "5000", "max_salary": "1000"})

    assert response.status_code == 200
    assert response.json()["items"] == []


def test_list_employees_salary_filter_pagination_metadata(
    client: TestClient, db_session: Session
) -> None:
    for i in range(1, 6):
        _employee_with_salary(db_session, i, amount="5000.00")
    db_session.commit()

    response = client.get(ENDPOINT, params={"min_salary": "1000", "page": 1, "page_size": 2})

    body = response.json()
    assert body["total"] == 5
    assert body["page_size"] == 2
    assert len(body["items"]) == 2
    assert body["has_next"] is True


def test_list_employees_combines_search_and_multiple_filters(
    client: TestClient, db_session: Session
) -> None:
    db_session.add_all(
        [
            _employee(1, first_name="Ada", country="UK", department="Engineering"),
            _employee(2, first_name="Ada", country="UK", department="Sales"),
            _employee(3, first_name="Ada", country="India", department="Engineering"),
            _employee(4, first_name="Mo", country="UK", department="Engineering"),
        ]
    )
    db_session.commit()

    response = client.get(
        ENDPOINT, params={"search": "Ada", "country": "UK", "department": "Engineering"}
    )

    body = response.json()
    assert [item["employee_code"] for item in body["items"]] == ["EMP-001"]


def test_list_employees_search_with_no_matches_returns_empty_page(
    client: TestClient, db_session: Session
) -> None:
    _seed_employees(db_session, 5)

    response = client.get(ENDPOINT, params={"search": "no-such-employee"})

    assert response.status_code == 200
    body = response.json()
    assert body == {"items": [], "page": 1, "page_size": DEFAULT_PAGE_SIZE, "total": 0, "has_next": False}


def test_list_employees_pagination_applied_after_filtering(
    client: TestClient, db_session: Session
) -> None:
    db_session.add_all(
        [_employee(i, department="Engineering") for i in range(1, 6)]
        + [_employee(i, department="Sales") for i in range(6, 9)]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"department": "Engineering", "page": 2, "page_size": 2})

    body = response.json()
    assert body["total"] == 5
    assert body["page"] == 2
    assert body["has_next"] is True
    assert [item["employee_code"] for item in body["items"]] == ["EMP-003", "EMP-004"]


def test_list_employees_default_sort_is_id_ascending(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, first_name="Zed"),
            _employee(2, first_name="Amy"),
            _employee(3, first_name="Mo"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT)

    assert [item["employee_code"] for item in response.json()["items"]] == [
        "EMP-001",
        "EMP-002",
        "EMP-003",
    ]


def test_list_employees_sort_by_first_name_ascending(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, first_name="Zed"),
            _employee(2, first_name="Amy"),
            _employee(3, first_name="Mo"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"sort_by": "first_name", "sort_order": "asc"})

    assert [item["first_name"] for item in response.json()["items"]] == ["Amy", "Mo", "Zed"]


def test_list_employees_sort_by_first_name_descending(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, first_name="Zed"),
            _employee(2, first_name="Amy"),
            _employee(3, first_name="Mo"),
        ]
    )
    db_session.commit()

    response = client.get(ENDPOINT, params={"sort_by": "first_name", "sort_order": "desc"})

    assert [item["first_name"] for item in response.json()["items"]] == ["Zed", "Mo", "Amy"]


@pytest.mark.parametrize(
    "field,values",
    [
        ("employee_code", None),
        ("last_name", ["Zeta", "Alpha", "Mu"]),
        ("department", ["Sales", "Engineering", "Marketing"]),
        ("country", ["UK", "Canada", "Germany"]),
        ("job_title", ["Manager", "Analyst", "Engineer"]),
        ("employment_status", None),
    ],
)
def test_list_employees_sort_by_each_supported_field(
    client: TestClient, db_session: Session, field: str, values: list[str] | None
) -> None:
    if values is None:
        employees = [_employee(1), _employee(2), _employee(3)]
    else:
        field_key = field
        employees = [_employee(i + 1, **{field_key: v}) for i, v in enumerate(values)]
    db_session.add_all(employees)
    db_session.commit()

    response = client.get(ENDPOINT, params={"sort_by": field, "sort_order": "asc"})

    assert response.status_code == 200
    returned = [item[field] for item in response.json()["items"]]
    assert returned == sorted(returned)


def test_list_employees_rejects_unsupported_sort_field(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"sort_by": "salary"})

    assert response.status_code == 422


def test_list_employees_rejects_invalid_sort_order(client: TestClient, db_session: Session) -> None:
    response = client.get(ENDPOINT, params={"sort_by": "first_name", "sort_order": "sideways"})

    assert response.status_code == 422


def test_list_employees_sort_combined_with_search(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, first_name="Ada", last_name="Zed"),
            _employee(2, first_name="Ada", last_name="Amy"),
        ]
    )
    db_session.commit()

    response = client.get(
        ENDPOINT, params={"search": "Ada", "sort_by": "last_name", "sort_order": "asc"}
    )

    body = response.json()
    assert body["total"] == 2
    assert [item["last_name"] for item in body["items"]] == ["Amy", "Zed"]


def test_list_employees_sort_combined_with_filters(client: TestClient, db_session: Session) -> None:
    db_session.add_all(
        [
            _employee(1, department="Engineering", first_name="Zed"),
            _employee(2, department="Sales", first_name="Amy"),
            _employee(3, department="Engineering", first_name="Amy"),
        ]
    )
    db_session.commit()

    response = client.get(
        ENDPOINT, params={"department": "Engineering", "sort_by": "first_name", "sort_order": "asc"}
    )

    body = response.json()
    assert body["total"] == 2
    assert [item["employee_code"] for item in body["items"]] == ["EMP-003", "EMP-001"]


def test_list_employees_sort_combined_with_pagination(client: TestClient, db_session: Session) -> None:
    db_session.add_all([_employee(i, first_name=f"Name{10 - i:02d}") for i in range(1, 11)])
    db_session.commit()

    response = client.get(
        ENDPOINT, params={"sort_by": "first_name", "sort_order": "asc", "page": 2, "page_size": 3}
    )

    body = response.json()
    assert body["total"] == 10
    # Ascending by first_name ("Name01".."Name09","Name10"); page 2 of 3.
    assert [item["first_name"] for item in body["items"]] == ["Name03", "Name04", "Name05"]


def test_list_employees_sort_is_stable_for_equal_values(client: TestClient, db_session: Session) -> None:
    # All employees share the same department, so sorting by department
    # alone is ambiguous; the id tiebreaker must still make it deterministic.
    db_session.add_all([_employee(i, department="Engineering") for i in [3, 1, 2]])
    db_session.commit()

    first_response = client.get(ENDPOINT, params={"sort_by": "department", "sort_order": "asc"}).json()
    second_response = client.get(ENDPOINT, params={"sort_by": "department", "sort_order": "asc"}).json()

    assert first_response == second_response
    # Tiebreaker is id ascending, i.e. insertion order (EMP-003, EMP-001, EMP-002).
    assert [item["employee_code"] for item in first_response["items"]] == [
        "EMP-003",
        "EMP-001",
        "EMP-002",
    ]


def test_get_employee_returns_existing_employee(client: TestClient, db_session: Session) -> None:
    employees = _seed_employees(db_session, 3)
    target = employees[1]

    response = client.get(f"{ENDPOINT}/{target.id}")

    assert response.status_code == 200
    assert response.json()["employee_code"] == "EMP-002"


def test_get_employee_response_fields(client: TestClient, db_session: Session) -> None:
    employees = _seed_employees(db_session, 1)
    target = employees[0]

    response = client.get(f"{ENDPOINT}/{target.id}")

    body = response.json()
    assert set(body.keys()) == {
        "id",
        "employee_code",
        "first_name",
        "last_name",
        "department",
        "country",
        "job_title",
        "employment_status",
    }
    assert body["id"] == target.id
    assert body["first_name"] == target.first_name
    assert body["last_name"] == target.last_name
    assert body["department"] == target.department
    assert body["country"] == target.country
    assert body["job_title"] == target.job_title
    assert body["employment_status"] == target.employment_status.value


def test_get_employee_uses_integer_id(client: TestClient, db_session: Session) -> None:
    employees = _seed_employees(db_session, 1)
    target = employees[0]

    response = client.get(f"{ENDPOINT}/{target.id}")

    assert response.status_code == 200
    assert isinstance(response.json()["id"], int)


def test_get_employee_not_found_returns_404(client: TestClient, db_session: Session) -> None:
    response = client.get(f"{ENDPOINT}/999999")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "EMPLOYEE_NOT_FOUND"
    assert "999999" in body["error"]["message"]


def test_get_employee_not_found_on_empty_database(client: TestClient, db_session: Session) -> None:
    response = client.get(f"{ENDPOINT}/1")

    assert response.status_code == 404


def test_get_employee_rejects_non_integer_id(client: TestClient, db_session: Session) -> None:
    response = client.get(f"{ENDPOINT}/not-a-number")

    assert response.status_code == 422


def test_list_employees_deterministic_ordering(client: TestClient, db_session: Session) -> None:
    # Inserted in an order unrelated to name/department, to confirm results
    # are ordered by id rather than any incidental insertion or name order.
    db_session.add_all(
        [
            _employee(1, first_name="Zed", department="Sales"),
            _employee(2, first_name="Amy", department="IT"),
            _employee(3, first_name="Mo", department="Finance"),
        ]
    )
    db_session.commit()

    first_response = client.get(ENDPOINT).json()
    second_response = client.get(ENDPOINT).json()

    codes = [item["employee_code"] for item in first_response["items"]]
    assert codes == ["EMP-001", "EMP-002", "EMP-003"]
    assert first_response == second_response


# --- POST /api/v1/employees -------------------------------------------------


def test_create_employee_returns_201(client: TestClient, db_session: Session) -> None:
    response = client.post(ENDPOINT, json=_employee_payload(1))

    assert response.status_code == 201
    body = response.json()
    assert body["employee_code"] == "EMP-001"
    assert body["first_name"] == "First1"
    assert body["last_name"] == "Last1"
    assert body["department"] == "Engineering"
    assert body["country"] == "UK"
    assert body["job_title"] == "Software Engineer"
    assert body["employment_status"] == "active"
    assert isinstance(body["id"], int)


def test_create_employee_response_fields(client: TestClient, db_session: Session) -> None:
    body = client.post(ENDPOINT, json=_employee_payload(1)).json()

    assert set(body.keys()) == {
        "id",
        "employee_code",
        "first_name",
        "last_name",
        "department",
        "country",
        "job_title",
        "employment_status",
    }


def test_create_employee_defaults_employment_status_to_active(
    client: TestClient, db_session: Session
) -> None:
    response = client.post(ENDPOINT, json=_employee_payload(1))

    assert response.json()["employment_status"] == "active"


def test_create_employee_accepts_explicit_employment_status(
    client: TestClient, db_session: Session
) -> None:
    response = client.post(
        ENDPOINT, json=_employee_payload(1, employment_status="terminated")
    )

    assert response.status_code == 201
    assert response.json()["employment_status"] == "terminated"


def test_create_employee_persists_and_can_be_retrieved(
    client: TestClient, db_session: Session
) -> None:
    created = client.post(ENDPOINT, json=_employee_payload(1)).json()

    response = client.get(f"{ENDPOINT}/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_create_employee_appears_in_listing(client: TestClient, db_session: Session) -> None:
    client.post(ENDPOINT, json=_employee_payload(1))

    response = client.get(ENDPOINT)

    assert response.json()["total"] == 1


def test_create_employee_missing_employee_code_returns_422(
    client: TestClient, db_session: Session
) -> None:
    payload = _employee_payload(1)
    del payload["employee_code"]

    response = client.post(ENDPOINT, json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    "field", ["employee_code", "first_name", "last_name", "department", "country", "job_title"]
)
def test_create_employee_missing_required_field_returns_422(
    client: TestClient, db_session: Session, field: str
) -> None:
    payload = _employee_payload(1)
    del payload[field]

    response = client.post(ENDPOINT, json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "field", ["employee_code", "first_name", "last_name", "department", "country", "job_title"]
)
def test_create_employee_empty_required_field_returns_422(
    client: TestClient, db_session: Session, field: str
) -> None:
    payload = _employee_payload(1, **{field: ""})

    response = client.post(ENDPOINT, json=payload)

    assert response.status_code == 422


def test_create_employee_rejects_invalid_employment_status(
    client: TestClient, db_session: Session
) -> None:
    response = client.post(ENDPOINT, json=_employee_payload(1, employment_status="on_leave"))

    assert response.status_code == 422


def test_create_employee_rejects_employee_code_too_long(
    client: TestClient, db_session: Session
) -> None:
    response = client.post(ENDPOINT, json=_employee_payload(1, employee_code="X" * 21))

    assert response.status_code == 422


def test_create_employee_rejects_non_string_employee_code(
    client: TestClient, db_session: Session
) -> None:
    response = client.post(ENDPOINT, json=_employee_payload(1, employee_code=12345))

    assert response.status_code == 422


def test_create_employee_duplicate_employee_code_returns_409(
    client: TestClient, db_session: Session
) -> None:
    client.post(ENDPOINT, json=_employee_payload(1))

    response = client.post(ENDPOINT, json=_employee_payload(2, employee_code="EMP-001"))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMPLOYEE_CODE_ALREADY_EXISTS"


def test_create_employee_duplicate_does_not_modify_existing_record(
    client: TestClient, db_session: Session
) -> None:
    first = client.post(ENDPOINT, json=_employee_payload(1)).json()

    client.post(
        ENDPOINT,
        json=_employee_payload(2, employee_code="EMP-001", first_name="Someone Else"),
    )

    persisted = db_session.execute(
        select(Employee).where(Employee.employee_code == "EMP-001")
    ).scalar_one()
    assert persisted.id == first["id"]
    assert persisted.first_name == "First1"


def test_create_employee_duplicate_does_not_create_a_second_row(
    client: TestClient, db_session: Session
) -> None:
    client.post(ENDPOINT, json=_employee_payload(1))
    client.post(ENDPOINT, json=_employee_payload(2, employee_code="EMP-001"))

    count = db_session.scalar(
        select(func.count()).select_from(Employee).where(Employee.employee_code == "EMP-001")
    )
    assert count == 1


def test_create_employee_service_rolls_back_and_raises_conflict_on_race(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A concurrent request could insert an employee with the same code
    after this call's own pre-check already found none; the database's
    unique constraint is the final guard for that race, and `create_employee`
    must translate the resulting `IntegrityError` into `ConflictError`
    without leaving the session broken or a duplicate row behind."""
    db_session.add(_employee(1))
    db_session.commit()

    monkeypatch.setattr(employee_service, "get_employee_by_code", lambda session, code: None)

    with pytest.raises(ConflictError):
        employee_service.create_employee(
            db_session, EmployeeCreate(**_employee_payload(2, employee_code="EMP-001"))
        )

    count = db_session.scalar(
        select(func.count()).select_from(Employee).where(Employee.employee_code == "EMP-001")
    )
    assert count == 1
    # The session must still be usable after the rollback.
    assert db_session.scalar(select(func.count()).select_from(Employee)) == 1


# --- PATCH /api/v1/employees/{employee_id} ---------------------------------


def test_update_employee_returns_200(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={"department": "Product"})

    assert response.status_code == 200
    assert response.json()["department"] == "Product"


def test_update_employee_partial_update_only_changes_supplied_fields(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={"department": "Product"})

    body = response.json()
    assert body["department"] == "Product"
    assert body["first_name"] == "First1"
    assert body["last_name"] == "Last1"
    assert body["country"] == "UK"
    assert body["job_title"] == "Software Engineer"
    assert body["employment_status"] == "active"
    assert body["employee_code"] == "EMP-001"


def test_update_employee_updates_multiple_fields_at_once(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(
        f"{ENDPOINT}/{employee.id}",
        json={"job_title": "Retired", "employment_status": "terminated"},
    )

    body = response.json()
    assert body["job_title"] == "Retired"
    assert body["employment_status"] == "terminated"


def test_update_employee_empty_body_is_a_no_op(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={})

    assert response.status_code == 200
    body = response.json()
    assert body["first_name"] == "First1"
    assert body["department"] == "Engineering"


def test_update_employee_response_fields(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    body = client.patch(f"{ENDPOINT}/{employee.id}", json={"department": "Sales"}).json()

    assert set(body.keys()) == {
        "id",
        "employee_code",
        "first_name",
        "last_name",
        "department",
        "country",
        "job_title",
        "employment_status",
    }


def test_update_employee_persists_and_is_visible_via_get(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    client.patch(f"{ENDPOINT}/{employee.id}", json={"country": "Germany"})

    response = client.get(f"{ENDPOINT}/{employee.id}")

    assert response.status_code == 200
    assert response.json()["country"] == "Germany"


def test_update_employee_persists_at_the_database_level(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    client.patch(f"{ENDPOINT}/{employee.id}", json={"last_name": "Hopper"})

    db_session.expire_all()
    persisted = db_session.get(Employee, employee.id)
    assert persisted.last_name == "Hopper"


def test_update_employee_for_nonexistent_employee_returns_404(
    client: TestClient, db_session: Session
) -> None:
    response = client.patch(f"{ENDPOINT}/999999", json={"department": "Sales"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_update_employee_rejects_non_integer_employee_id(
    client: TestClient, db_session: Session
) -> None:
    response = client.patch(f"{ENDPOINT}/not-a-number", json={"department": "Sales"})

    assert response.status_code == 422


def test_update_employee_rejects_empty_first_name(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={"first_name": ""})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    "field", ["first_name", "last_name", "department", "country", "job_title"]
)
def test_update_employee_rejects_empty_string_field(
    client: TestClient, db_session: Session, field: str
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={field: ""})

    assert response.status_code == 422


@pytest.mark.parametrize(
    "field",
    ["first_name", "last_name", "department", "country", "job_title", "employment_status"],
)
def test_update_employee_rejects_explicit_null(
    client: TestClient, db_session: Session, field: str
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={field: None})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_update_employee_rejects_invalid_employment_status(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(
        f"{ENDPOINT}/{employee.id}", json={"employment_status": "on_leave"}
    )

    assert response.status_code == 422


def test_update_employee_rejects_field_too_long(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={"department": "X" * 101})

    assert response.status_code == 422


def test_update_employee_cannot_change_employee_code(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={"employee_code": "EMP-999"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert any(detail["location"] == ["body", "employee_code"] for detail in body["error"]["details"])


def test_update_employee_cannot_change_id(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.patch(f"{ENDPOINT}/{employee.id}", json={"id": 999999})

    assert response.status_code == 422


def test_update_employee_employee_code_is_unaffected_by_other_field_updates(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    client.patch(f"{ENDPOINT}/{employee.id}", json={"department": "Product"})

    persisted = db_session.execute(
        select(Employee).where(Employee.id == employee.id)
    ).scalar_one()
    assert persisted.employee_code == "EMP-001"


def test_update_employee_does_not_affect_other_employees(
    client: TestClient, db_session: Session
) -> None:
    employees = _seed_employees(db_session, 2)
    target, other = employees[0], employees[1]

    client.patch(f"{ENDPOINT}/{target.id}", json={"department": "Product"})

    unaffected = db_session.execute(select(Employee).where(Employee.id == other.id)).scalar_one()
    assert unaffected.department == "Engineering"


def test_update_employee_does_not_affect_salary(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    client.patch(f"{ENDPOINT}/{employee.id}", json={"department": "Product"})

    response = client.get(f"{ENDPOINT}/{employee.id}/salary")
    assert response.status_code == 200
    assert response.json()["amount"] == "1000.00"


def test_update_employee_service_raises_not_found_for_missing_employee(
    db_session: Session,
) -> None:
    with pytest.raises(NotFoundError):
        employee_service.update_employee(
            db_session, 999999, EmployeeUpdate(department="Product")
        )


def test_update_employee_service_rolls_back_on_persistence_failure(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    def _boom() -> None:
        raise RuntimeError("simulated persistence failure")

    monkeypatch.setattr(db_session, "commit", _boom)

    with pytest.raises(RuntimeError):
        employee_service.update_employee(
            db_session, employee.id, EmployeeUpdate(department="Product")
        )

    # `session.rollback()` inside `update_employee` must both revert the
    # in-memory attribute change and leave the session usable for the
    # query below (rather than leaving it in a broken "pending rollback"
    # state).
    db_session.expire_all()
    persisted = db_session.get(Employee, employee.id)
    assert persisted.department == "Engineering"


# --- DELETE /api/v1/employees/{employee_id} ---------------------------------


def test_delete_employee_returns_204(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.delete(f"{ENDPOINT}/{employee.id}")

    assert response.status_code == 204
    assert response.content == b""


def test_delete_employee_removes_it_from_the_database(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    client.delete(f"{ENDPOINT}/{employee.id}")

    remaining = db_session.get(Employee, employee.id)
    assert remaining is None


def test_delete_employee_subsequent_get_returns_404(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    client.delete(f"{ENDPOINT}/{employee.id}")
    response = client.get(f"{ENDPOINT}/{employee.id}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_delete_employee_removes_it_from_listing(client: TestClient, db_session: Session) -> None:
    employees = _seed_employees(db_session, 2)

    client.delete(f"{ENDPOINT}/{employees[0].id}")

    response = client.get(ENDPOINT)
    assert response.json()["total"] == 1


def test_delete_employee_for_nonexistent_employee_returns_404(
    client: TestClient, db_session: Session
) -> None:
    response = client.delete(f"{ENDPOINT}/999999")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMPLOYEE_NOT_FOUND"


def test_delete_employee_twice_returns_404_on_second_attempt(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    first = client.delete(f"{ENDPOINT}/{employee.id}")
    second = client.delete(f"{ENDPOINT}/{employee.id}")

    assert first.status_code == 204
    assert second.status_code == 404


def test_delete_employee_rejects_non_integer_employee_id(
    client: TestClient, db_session: Session
) -> None:
    response = client.delete(f"{ENDPOINT}/not-a-number")

    assert response.status_code == 422


def test_delete_employee_does_not_affect_other_employees(
    client: TestClient, db_session: Session
) -> None:
    employees = _seed_employees(db_session, 2)
    target, other = employees[0], employees[1]

    client.delete(f"{ENDPOINT}/{target.id}")

    response = client.get(f"{ENDPOINT}/{other.id}")
    assert response.status_code == 200
    assert response.json()["id"] == other.id


# --- DELETE /{employee_id} and the Employee-Salary relationship -----------


def test_delete_employee_with_salary_succeeds(client: TestClient, db_session: Session) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    response = client.delete(f"{ENDPOINT}/{employee.id}")

    assert response.status_code == 204


def test_delete_employee_also_deletes_its_salary(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    client.delete(f"{ENDPOINT}/{employee.id}")

    remaining = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one_or_none()
    assert remaining is None


def test_delete_employee_leaves_no_orphaned_salary_rows(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    client.delete(f"{ENDPOINT}/{employee.id}")

    count = db_session.scalar(select(func.count()).select_from(Salary))
    assert count == 0


def test_delete_employee_without_salary_succeeds(
    client: TestClient, db_session: Session
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.commit()

    response = client.delete(f"{ENDPOINT}/{employee.id}")

    assert response.status_code == 204


def test_delete_employee_leaves_other_employees_salaries_intact(
    client: TestClient, db_session: Session
) -> None:
    target = _employee(1)
    other = _employee(2)
    db_session.add_all([target, other])
    db_session.flush()
    db_session.add_all(
        [
            Salary(employee_id=target.id, amount=Decimal("1000.00"), currency="USD"),
            Salary(employee_id=other.id, amount=Decimal("2000.00"), currency="GBP"),
        ]
    )
    db_session.commit()

    client.delete(f"{ENDPOINT}/{target.id}")

    other_salary = db_session.execute(
        select(Salary).where(Salary.employee_id == other.id)
    ).scalar_one()
    assert other_salary.amount == Decimal("2000.00")
    assert other_salary.currency == "GBP"


def test_delete_employee_service_raises_not_found_for_missing_employee(
    db_session: Session,
) -> None:
    with pytest.raises(NotFoundError):
        employee_service.delete_employee(db_session, 999999)


def test_delete_employee_service_rolls_back_on_persistence_failure(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    employee = _employee(1)
    db_session.add(employee)
    db_session.flush()
    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000.00"), currency="USD"))
    db_session.commit()

    def _boom() -> None:
        raise RuntimeError("simulated persistence failure")

    monkeypatch.setattr(db_session, "commit", _boom)

    with pytest.raises(RuntimeError):
        employee_service.delete_employee(db_session, employee.id)

    # `session.rollback()` inside `delete_employee` must both revert the
    # pending delete and leave the session usable for the queries below
    # (rather than leaving it in a broken "pending rollback" state).
    db_session.expire_all()
    assert db_session.get(Employee, employee.id) is not None
    remaining_salary = db_session.execute(
        select(Salary).where(Salary.employee_id == employee.id)
    ).scalar_one_or_none()
    assert remaining_salary is not None
    assert remaining_salary.amount == Decimal("1000.00")
