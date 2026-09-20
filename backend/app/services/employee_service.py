"""Business logic for employee queries, independent of the HTTP layer."""

from dataclasses import dataclass

from sqlalchemy import ColumnElement, and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
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


def get_employee(session: Session, employee_id: int) -> Employee | None:
    """Return the employee with `employee_id`, or `None` if none exists.

    Looks up by primary key via `Session.get`, which returns at most one row
    (and serves it from the identity map when already loaded) rather than
    running a fresh `SELECT` every time.
    """
    return session.get(Employee, employee_id)


def get_employee_by_code(session: Session, employee_code: str) -> Employee | None:
    """Return the employee with `employee_code`, or `None` if none exists.

    `Employee.employee_code` is unique, so at most one row can match.
    """
    statement = select(Employee).where(Employee.employee_code == employee_code)
    return session.execute(statement).scalar_one_or_none()


def create_employee(session: Session, data: EmployeeCreate) -> Employee:
    """Create a new employee from `data`.

    `Employee.employee_code` is unique, so a duplicate code is rejected
    with `ConflictError` rather than silently failing with a raw database
    error. That check and the insert happen in the same request, but a
    concurrent request could still race past it before either commits; the
    database's own unique constraint is the final guard for that case, so
    a resulting `IntegrityError` on commit is rolled back and translated
    into the same `ConflictError` instead of surfacing as a raw database
    error — mirroring `salary_service.create_salary`.
    """
    if get_employee_by_code(session, data.employee_code) is not None:
        raise ConflictError(
            code="EMPLOYEE_CODE_ALREADY_EXISTS",
            message=f"Employee code {data.employee_code!r} already exists",
        )

    employee = Employee(
        employee_code=data.employee_code,
        first_name=data.first_name,
        last_name=data.last_name,
        department=data.department,
        country=data.country,
        job_title=data.job_title,
        employment_status=data.employment_status,
    )
    session.add(employee)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise ConflictError(
            code="EMPLOYEE_CODE_ALREADY_EXISTS",
            message=f"Employee code {data.employee_code!r} already exists",
        ) from None

    return employee


def update_employee(session: Session, employee_id: int, data: EmployeeUpdate) -> Employee:
    """Partially update the employee identified by `employee_id`.

    Only fields the client actually supplied in `data` are changed (PATCH
    semantics, via `model_dump(exclude_unset=True)`) — omitted fields keep
    their current value. Raises `NotFoundError` if no employee with
    `employee_id` exists. `id` and `employee_code` are never touched here
    (they're excluded from `EmployeeUpdate` entirely — see its docstring),
    and no uniqueness conflict is possible from this operation as a
    result, unlike `create_employee`. Committed within the same
    transaction; if the commit fails, the session is rolled back (which
    also reverts the in-memory attribute changes made below, since a
    rollback expires every object in the session) and the exception is
    re-raised for the centralized unexpected-error handler, rather than
    leaving a partial update in place or exposing a raw database error.
    """
    employee = get_employee(session, employee_id)
    if employee is None:
        raise NotFoundError(
            code="EMPLOYEE_NOT_FOUND", message=f"Employee {employee_id} not found"
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)

    try:
        session.commit()
    except Exception:
        session.rollback()
        raise

    return employee


def delete_employee(session: Session, employee_id: int) -> None:
    """Delete the employee identified by `employee_id`.

    Raises `NotFoundError` if no employee with `employee_id` exists.
    `Employee.salary` is configured with `cascade="all, delete-orphan"`,
    and `Salary.employee_id` has a matching `ondelete="CASCADE"` foreign
    key (see `app.models.employee.Employee` / `app.models.salary.Salary`)
    — so deleting an employee through the ORM session automatically
    deletes its salary record too, in the same flush/transaction, without
    any separate delete call here (verified empirically: no orphaned
    `Salary` row survives). Committed within the same transaction; if
    persistence fails, the session is rolled back (so nothing is left
    partially deleted) and the exception is re-raised for the centralized
    unexpected-error handler rather than exposing a raw database error.
    """
    employee = get_employee(session, employee_id)
    if employee is None:
        raise NotFoundError(
            code="EMPLOYEE_NOT_FOUND", message=f"Employee {employee_id} not found"
        )

    session.delete(employee)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise


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
