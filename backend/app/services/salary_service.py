"""Business logic for salary queries, independent of the HTTP layer."""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import ColumnElement, and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models.employee import Employee
from app.models.salary import Salary
from app.schemas.salary import SalaryCreate, SalaryUpdate
from app.utils.pagination import Page, PaginationParams, paginate
from app.utils.sorting import SortOrder, apply_sort

# Allowlist of salary fields clients may sort by, mapping the public name to
# its actual column. `apply_sort` only ever looks a name up here — a
# user-supplied `sort_by` string can never reach a query directly.
SALARY_SORTABLE_FIELDS: dict[str, ColumnElement] = {
    "id": Salary.id,
    "employee_id": Salary.employee_id,
    "amount": Salary.amount,
    "currency": Salary.currency,
}

DEFAULT_SALARY_SORT_BY = "id"
DEFAULT_SALARY_SORT_ORDER = SortOrder.ASC


@dataclass(frozen=True)
class SalaryFilters:
    """Optional salary listing filter criteria, combined with AND.

    All fields are optional (and default to `None`, meaning "no
    constraint"), so passing an empty `SalaryFilters()` preserves the
    unfiltered listing behavior. `department`/`country` filter on the
    associated employee (via `Salary.employee_id`), not on `Salary` itself.
    """

    employee_id: int | None = None
    currency: str | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    department: str | None = None
    country: str | None = None


@dataclass(frozen=True)
class SalarySort:
    """Validated sort field/direction; defaults reproduce the original,
    pre-sorting listing order (`id` ascending)."""

    sort_by: str = DEFAULT_SALARY_SORT_BY
    sort_order: SortOrder = DEFAULT_SALARY_SORT_ORDER


def get_salary_for_employee(session: Session, employee_id: int) -> Salary | None:
    """Return the salary record for `employee_id`, or `None` if it has none.

    `Salary.employee_id` is unique (an employee has at most one active
    salary; see `app.models.salary.Salary`), so `scalar_one_or_none` is
    safe here and, unlike a plain `first()`, raises rather than silently
    picking an arbitrary row if that constraint were ever violated.
    """
    statement = select(Salary).where(Salary.employee_id == employee_id)
    return session.execute(statement).scalar_one_or_none()


def create_salary(session: Session, employee_id: int, data: SalaryCreate) -> Salary:
    """Create the salary record for `employee_id` from `data`.

    Each employee may have at most one salary record (`Salary.employee_id`
    is unique; see `app.models.salary.Salary`, FR-2.2), so an existing
    record is checked for first and rejected with `ConflictError` rather
    than silently overwritten or duplicated. That check and the insert
    happen in the same request, but a concurrent request could still race
    past it before either commits; the database's own unique constraint is
    the final guard for that case, so a resulting `IntegrityError` on
    commit is rolled back and translated into the same `ConflictError`
    instead of surfacing as a raw database error. The caller is
    responsible for confirming `employee_id` refers to an existing
    employee first (see `_get_employee_or_404` in the employees route) —
    this function only checks for a pre-existing salary.
    """
    if get_salary_for_employee(session, employee_id) is not None:
        raise ConflictError(
            code="SALARY_ALREADY_EXISTS",
            message=f"Employee {employee_id} already has a salary record",
        )

    salary = Salary(employee_id=employee_id, amount=data.amount, currency=data.currency)
    session.add(salary)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise ConflictError(
            code="SALARY_ALREADY_EXISTS",
            message=f"Employee {employee_id} already has a salary record",
        ) from None

    return salary


def update_salary(session: Session, employee_id: int, data: SalaryUpdate) -> Salary:
    """Replace the existing salary record for `employee_id` with `data`.

    This only updates an existing record — it never creates one (see
    `create_salary` for that) — so a missing salary raises `NotFoundError`
    rather than being silently created. `employee_id` itself is never
    reassigned: it's how the record is looked up, not a field `data`
    carries. The row is mutated in place and committed within the same
    transaction; if the commit fails, the session is rolled back (which
    also reverts the in-memory attribute changes made below, since a
    rollback expires every object in the session) and the exception is
    re-raised for the centralized unexpected-error handler, rather than
    leaving a partial update in place or exposing a raw database error.
    """
    salary = get_salary_for_employee(session, employee_id)
    if salary is None:
        raise NotFoundError(
            code="SALARY_NOT_FOUND",
            message=f"No salary record found for employee {employee_id}",
        )

    salary.amount = data.amount
    salary.currency = data.currency
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise

    return salary


def delete_salary(session: Session, employee_id: int) -> None:
    """Delete the salary record for `employee_id`.

    Raises `NotFoundError` if the employee has no salary record to delete
    (there is nothing documented in `docs/requirements.md` restricting
    salary deletion otherwise, so no further business check is applied).
    `Salary.employee_id` is the foreign key on the child (`salaries`) side
    of the one-to-one relationship — `employees` has no column referencing
    `salaries` — so deleting a `Salary` row here can never cascade to, or
    otherwise affect, its `Employee` row. Committed within the same
    transaction; if persistence fails, the session is rolled back (so the
    row is not left half-deleted) and the exception is re-raised for the
    centralized unexpected-error handler rather than exposing a raw
    database error.
    """
    salary = get_salary_for_employee(session, employee_id)
    if salary is None:
        raise NotFoundError(
            code="SALARY_NOT_FOUND",
            message=f"No salary record found for employee {employee_id}",
        )

    session.delete(salary)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise


def list_salaries(
    session: Session,
    pagination: PaginationParams,
    filters: SalaryFilters | None = None,
    sort: SalarySort | None = None,
) -> Page[Salary]:
    """Return one page of salaries matching `filters`, sorted by `sort`.

    `filters.employee_id`/`currency` are exact-match filters on `Salary`
    itself; `min_amount`/`max_amount` bound `amount` inclusively (a
    `min_amount` above `max_amount` is not rejected — it simply matches no
    rows, since both conditions are ANDed together, so it behaves the same
    as any other overly-narrow filter combination rather than needing
    special-cased validation). `department`/`country` filter on the
    associated `Employee` and only add a join to it when requested, since
    `Salary.employee_id` is a unique, non-nullable foreign key to
    `employees.id` (see `app.models.salary.Salary`) — an inner join can
    therefore never multiply or drop rows relative to the unjoined `Salary`
    query. All filters are combined with AND and applied before sorting and
    pagination, so `total`/`has_next` reflect the filtered result set.
    `sort` (default: `id` ascending) is applied via `apply_sort`, with `id`
    as a stable tie-breaker so rows sharing the same sort value still come
    back in a deterministic order across pages. Pagination itself is still
    applied at the database level via `paginate` (offset/limit plus a
    `COUNT` query on the same statement), so the full salary table is never
    loaded into memory.
    """
    statement = select(Salary)

    filters = filters or SalaryFilters()
    if filters.department or filters.country:
        statement = statement.join(Employee, Salary.employee_id == Employee.id)

    conditions = build_filter_conditions(filters)
    if conditions:
        statement = statement.where(and_(*conditions))

    sort = sort or SalarySort()
    statement = apply_sort(
        statement, SALARY_SORTABLE_FIELDS, sort.sort_by, sort.sort_order, tiebreaker=Salary.id
    )

    return paginate(session, statement, pagination)


def build_filter_conditions(filters: SalaryFilters) -> list[ColumnElement[bool]]:
    """Translate `filters` into a list of SQLAlchemy `WHERE` conditions.

    Shared with `analytics_service`, which reuses this rather than
    reimplementing the same filter semantics for salary statistics
    (`docs/requirements.md` FR-6.5: analytics reflect any active filters).
    """
    conditions: list[ColumnElement[bool]] = []

    if filters.employee_id is not None:
        conditions.append(Salary.employee_id == filters.employee_id)
    if filters.currency:
        conditions.append(Salary.currency == filters.currency)
    if filters.min_amount is not None:
        conditions.append(Salary.amount >= filters.min_amount)
    if filters.max_amount is not None:
        conditions.append(Salary.amount <= filters.max_amount)
    if filters.department:
        conditions.append(Employee.department == filters.department)
    if filters.country:
        conditions.append(Employee.country == filters.country)

    return conditions
