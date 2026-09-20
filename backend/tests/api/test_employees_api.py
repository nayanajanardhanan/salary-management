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
