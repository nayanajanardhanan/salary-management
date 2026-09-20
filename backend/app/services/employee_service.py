"""Business logic for employee queries, independent of the HTTP layer."""

from dataclasses import dataclass

from sqlalchemy import ColumnElement, and_, or_, select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.utils.pagination import Page, PaginationParams, paginate
from app.utils.sorting import SortOrder, apply_sort

# Allowlist of employee fields clients may sort by, mapping the public name
# to its actual column. `apply_sort` only ever looks a name up here — a
# user-supplied `sort_by` string can never reach a query directly.
SORTABLE_FIELDS: dict[str, ColumnElement] = {
    "id": Employee.id,
    "employee_code": Employee.employee_code,
    "first_name": Employee.first_name,
    "last_name": Employee.last_name,
    "department": Employee.department,
    "country": Employee.country,
    "job_title": Employee.job_title,
    "employment_status": Employee.employment_status,
}

DEFAULT_SORT_BY = "id"
DEFAULT_SORT_ORDER = SortOrder.ASC


@dataclass(frozen=True)
class EmployeeFilters:
    """Optional employee search/filter criteria, combined with AND.

    All fields are optional (and default to `None`, meaning "no
    constraint"), so passing an empty `EmployeeFilters()` preserves the
    unfiltered listing behavior.
    """

    search: str | None = None
    country: str | None = None
    department: str | None = None


@dataclass(frozen=True)
class EmployeeSort:
    """Validated sort field/direction; defaults reproduce the original,
    pre-sorting listing order (`id` ascending)."""

    sort_by: str = DEFAULT_SORT_BY
    sort_order: SortOrder = DEFAULT_SORT_ORDER


def list_employees(
    session: Session,
    pagination: PaginationParams,
    filters: EmployeeFilters | None = None,
    sort: EmployeeSort | None = None,
) -> Page[Employee]:
    """Return one page of employees matching `filters`, sorted by `sort`.

    `filters.search` matches, case-insensitively, against `employee_code`,
    `first_name`, or `last_name` (OR'd together); `country`/`department` are
    exact-match filters. All are combined with AND and applied before
    sorting and pagination, so `total`/`has_next` reflect the filtered
    result set. `sort` (default: `id` ascending) is applied via
    `apply_sort`, with `id` as a stable tie-breaker so rows sharing the same
    sort value still come back in a deterministic order across pages.
    Pagination itself is still applied at the database level via `paginate`
    (offset/limit plus a `COUNT` query on the same statement), so the full
    employee table is never loaded into memory.
    """
    statement = select(Employee)

    conditions = _build_filter_conditions(filters) if filters else []
    if conditions:
        statement = statement.where(and_(*conditions))

    sort = sort or EmployeeSort()
    statement = apply_sort(
        statement, SORTABLE_FIELDS, sort.sort_by, sort.sort_order, tiebreaker=Employee.id
    )

    return paginate(session, statement, pagination)


def _build_filter_conditions(filters: EmployeeFilters) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []

    if filters.search:
        term = f"%{filters.search}%"
        conditions.append(
            or_(
                Employee.employee_code.ilike(term),
                Employee.first_name.ilike(term),
                Employee.last_name.ilike(term),
            )
        )
    if filters.country:
        conditions.append(Employee.country == filters.country)
    if filters.department:
        conditions.append(Employee.department == filters.department)

    return conditions
