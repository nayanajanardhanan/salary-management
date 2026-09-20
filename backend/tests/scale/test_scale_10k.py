"""Scale verification: ~10,000 employees (NFR 4.2, NFR 4.3, Acceptance Criterion 8.9).

Opt-in via the `scale` marker (see `pyproject.toml` `addopts` and
`backend/README.md`), since generating and inserting ~10,000 employee/salary
rows is too slow to run on every default `pytest` invocation. Run
explicitly with:

    pytest -m scale

Reuses existing infrastructure end-to-end rather than duplicating any of
it:

* `app.data_generation.generate_employee_dataset` / `app.scripts.seed.
  seed_database` build and insert the dataset — the same reusable dataset
  generator and insertion helper `tests/scripts/test_seed.py` already
  exercises for small counts. No second data-generation or bulk-insert
  implementation is introduced.
* The isolated in-memory SQLite database is built the same way as the
  shared `db_session` fixture in `tests/conftest.py` (`create_db_engine`
  with `StaticPool`), just at module scope so the ~10k rows are seeded once
  and reused by every test below instead of once per test.
* Every assertion below goes through the real `/api/v1/...` endpoints via
  `TestClient`, exactly like every other API test in `tests/api/` — so
  pagination, filtering, sorting, and analytics are exercised exactly as
  production code runs them, and a page response can never "cheat" by
  secretly loading the whole table into this test process.
"""

from collections import defaultdict
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 (registers models on Base.metadata)
from app.core.config import Settings, get_settings
from app.data_generation import generate_employee_dataset
from app.data_generation.dataset import EmployeeDataset
from app.db.base import Base
from app.db.session import create_db_engine, get_db
from app.main import app
from app.scripts.seed import seed_database
from app.utils.pagination import MAX_PAGE_SIZE
from tests.conftest import TEST_API_TOKEN

pytestmark = pytest.mark.scale

EMPLOYEE_COUNT = 10_000
# Arbitrary, fixed seed: the dataset (and therefore every assertion below)
# is fully deterministic and reproducible across runs/machines.
DATASET_SEED = 20240115


@pytest.fixture(scope="module")
def scale_db_session() -> Session:
    """An isolated, in-memory SQLite session, seeded once with ~10k employees.

    Module-scoped (unlike the function-scoped `db_session` in
    `tests/conftest.py`) so the relatively expensive seed only runs once for
    every test in this file, not once per test.
    """
    engine = create_db_engine("sqlite:///:memory:", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        seed_database(session, count=EMPLOYEE_COUNT, seed=DATASET_SEED)
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture(scope="module")
def scale_client(scale_db_session: Session) -> TestClient:
    """A `TestClient` against the ~10k-employee database, authenticated like the shared `client` fixture."""
    app.dependency_overrides[get_db] = lambda: scale_db_session
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, api_token=TEST_API_TOKEN
    )
    try:
        yield TestClient(app, headers={"Authorization": f"Bearer {TEST_API_TOKEN}"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_settings, None)


@pytest.fixture(scope="module")
def expected_dataset() -> EmployeeDataset:
    """The same generated dataset `scale_db_session` inserts, kept for independent expected values.

    `seed_database` calls `generate_employee_dataset` internally with the
    same `count`/`seed`; regenerating it here (cheap: pure in-memory
    dataclasses, no I/O) gives tests a source of truth to check the API
    response against, without querying the database directly and without
    re-deriving pagination/filtering/analytics logic — the same pattern
    `tests/scripts/test_seed.py` already uses.
    """
    return generate_employee_dataset(EMPLOYEE_COUNT, seed=DATASET_SEED)


def _expected_currency_stats(salaries) -> dict[str, dict[str, Decimal | int]]:
    amounts_by_currency: dict[str, list[Decimal]] = defaultdict(list)
    for salary in salaries:
        amounts_by_currency[salary.currency].append(salary.amount)

    return {
        currency: {
            "count": len(amounts),
            "sum": sum(amounts, Decimal("0")),
            "min": min(amounts),
            "max": max(amounts),
        }
        for currency, amounts in amounts_by_currency.items()
    }


# --- A. Employee listing ----------------------------------------------------


def test_employee_listing_returns_one_bounded_page_with_correct_total(
    scale_client: TestClient,
) -> None:
    response = scale_client.get("/api/v1/employees", params={"page": 1, "page_size": 50})

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 50
    assert body["page"] == 1
    assert body["page_size"] == 50
    assert body["total"] == EMPLOYEE_COUNT
    assert body["has_next"] is True


# --- B. Search ---------------------------------------------------------------


def test_search_finds_a_known_employee_without_returning_the_entire_dataset(
    scale_client: TestClient, expected_dataset: EmployeeDataset
) -> None:
    target = expected_dataset.employees[4_999]  # employee_code "EMP-005000"

    response = scale_client.get("/api/v1/employees", params={"search": target.employee_code})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["employee_code"] == target.employee_code
    assert item["first_name"] == target.first_name
    assert item["last_name"] == target.last_name


# --- C. Filtering --------------------------------------------------------------


def test_department_filter_returns_only_matching_bounded_subset(
    scale_client: TestClient,
) -> None:
    response = scale_client.get("/api/v1/employees", params={"department": "Engineering"})

    assert response.status_code == 200
    body = response.json()
    assert 0 < body["total"] < EMPLOYEE_COUNT
    assert len(body["items"]) <= body["page_size"]
    assert all(item["department"] == "Engineering" for item in body["items"])


def test_country_filter_returns_only_matching_bounded_subset(scale_client: TestClient) -> None:
    response = scale_client.get("/api/v1/employees", params={"country": "United Kingdom"})

    assert response.status_code == 200
    body = response.json()
    assert 0 < body["total"] < EMPLOYEE_COUNT
    assert len(body["items"]) <= body["page_size"]
    assert all(item["country"] == "United Kingdom" for item in body["items"])


def test_salary_range_filter_returns_only_matching_bounded_subset(
    scale_client: TestClient,
) -> None:
    response = scale_client.get(
        "/api/v1/employees",
        params={"currency": "USD", "min_salary": "100000", "max_salary": "150000"},
    )

    assert response.status_code == 200
    body = response.json()
    assert 0 < body["total"] < EMPLOYEE_COUNT
    assert len(body["items"]) <= body["page_size"]
    for item in body["items"]:
        assert item["salary"]["currency"] == "USD"
        amount = Decimal(item["salary"]["amount"])
        assert Decimal("100000") <= amount <= Decimal("150000")


# --- D. Pagination -------------------------------------------------------------


def test_successive_pages_are_bounded_non_overlapping_and_cover_a_consistent_total(
    scale_client: TestClient,
) -> None:
    page_size = MAX_PAGE_SIZE  # the largest single page the API allows
    seen_ids: set[int] = set()
    total_from_first_page: int | None = None

    for page in range(1, 6):  # 5 pages * MAX_PAGE_SIZE (100) = 500 of the 10,000 employees
        response = scale_client.get(
            "/api/v1/employees", params={"page": page, "page_size": page_size}
        )

        assert response.status_code == 200
        body = response.json()
        assert len(body["items"]) == page_size
        assert body["page"] == page
        assert body["page_size"] == page_size

        if total_from_first_page is None:
            total_from_first_page = body["total"]
        assert body["total"] == total_from_first_page == EMPLOYEE_COUNT
        assert body["has_next"] is True

        page_ids = {item["id"] for item in body["items"]}
        assert page_ids.isdisjoint(seen_ids)
        seen_ids.update(page_ids)

    assert len(seen_ids) == 5 * page_size


# --- E. Analytics ----------------------------------------------------------------


def test_overall_analytics_are_correct_and_never_combine_currencies(
    scale_client: TestClient, expected_dataset: EmployeeDataset
) -> None:
    response = scale_client.get("/api/v1/analytics/salary")

    assert response.status_code == 200
    body = response.json()

    expected = _expected_currency_stats(expected_dataset.salaries)
    # Every currency actually present in the dataset gets exactly one
    # `overall` entry -- never a combined figure spanning currencies.
    assert {entry["currency"] for entry in body["overall"]} == set(expected)
    assert len(body["overall"]) == len(expected)
    assert sum(entry["count"] for entry in body["overall"]) == EMPLOYEE_COUNT

    for entry in body["overall"]:
        exp = expected[entry["currency"]]
        assert entry["count"] == exp["count"]
        assert Decimal(entry["minimum"]) == exp["min"]
        assert Decimal(entry["maximum"]) == exp["max"]
        assert Decimal(entry["average"]) == exp["sum"] / Decimal(exp["count"])


def test_grouped_analytics_stay_consistent_with_overall_at_scale(
    scale_client: TestClient,
) -> None:
    response = scale_client.get("/api/v1/analytics/salary")

    assert response.status_code == 200
    body = response.json()
    assert body["by_department"]
    assert body["by_country"]

    overall_counts = {entry["currency"]: entry["count"] for entry in body["overall"]}

    department_counts: dict[str, int] = defaultdict(int)
    for entry in body["by_department"]:
        department_counts[entry["currency"]] += entry["count"]

    country_counts: dict[str, int] = defaultdict(int)
    for entry in body["by_country"]:
        country_counts[entry["currency"]] += entry["count"]

    # Summing the grouped breakdowns back up reproduces the overall,
    # per-currency counts exactly -- grouping doesn't drop or duplicate
    # rows at this scale, and no group mixes two currencies together.
    assert dict(department_counts) == overall_counts
    assert dict(country_counts) == overall_counts
