import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.employee import Employee
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
