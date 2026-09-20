"""Business logic for salary queries, independent of the HTTP layer."""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import ColumnElement, and_, select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.salary import Salary
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

    conditions = _build_filter_conditions(filters)
    if conditions:
        statement = statement.where(and_(*conditions))

    sort = sort or SalarySort()
    statement = apply_sort(
        statement, SALARY_SORTABLE_FIELDS, sort.sort_by, sort.sort_order, tiebreaker=Salary.id
    )

    return paginate(session, statement, pagination)


def _build_filter_conditions(filters: SalaryFilters) -> list[ColumnElement[bool]]:
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
