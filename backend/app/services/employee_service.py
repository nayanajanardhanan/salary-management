"""Business logic for employee queries, independent of the HTTP layer."""

from dataclasses import dataclass

from sqlalchemy import ColumnElement, and_, or_, select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.utils.pagination import Page, PaginationParams, paginate


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


def list_employees(
    session: Session, pagination: PaginationParams, filters: EmployeeFilters | None = None
) -> Page[Employee]:
    """Return one page of employees matching `filters`, ordered by `id`.

    `filters.search` matches, case-insensitively, against `employee_code`,
    `first_name`, or `last_name` (OR'd together); `country`/`department` are
    exact-match filters. All are combined with AND, applied before
    pagination, so `total`/`has_next` reflect the filtered result set.
    Pagination itself is still applied at the database level via `paginate`
    (offset/limit plus a `COUNT` query on the same filtered statement), so
    the full employee table is never loaded into memory.
    """
    statement = select(Employee)

    conditions = _build_filter_conditions(filters) if filters else []
    if conditions:
        statement = statement.where(and_(*conditions))

    statement = statement.order_by(Employee.id)
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
