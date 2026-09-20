"""Business logic for salary statistics/aggregation, independent of the HTTP layer.

Implements `docs/requirements.md` FR-6.1-FR-6.5: count/average/minimum/
maximum salary figures, overall and grouped by department (FR-6.2) and by
country (FR-6.3), always scoped to a single currency at a time (FR-6.4,
Section 5) and reflecting any active filters (FR-6.5). `docs/requirements.md`
does not document a "total"/sum figure (FR-6.1 lists only count, average,
minimum, maximum), so none is exposed here.

Aggregation is computed entirely in SQL (`COUNT`/`SUM`/`MIN`/`MAX` with
`GROUP BY`) rather than in Python, per `docs/architecture.md` Sections
1.3/4.3/9 — the full salary table is never loaded into the API process.
Three separate `GROUP BY` queries are used (overall, by department, by
country) rather than one combined query with `GROUPING SETS`/`ROLLUP`:
each query's cost is fixed by the number of distinct groups, not by the
number of salary rows, so this isn't an N+1 pattern, and `GROUPING SETS`
isn't supported by SQLite (used for local dev/test — `docs/architecture.md`
Section 6.1), so relying on it would break portability between SQLite and
PostgreSQL.

`average` is derived from the SQL-computed `SUM` and `COUNT`
(`total / Decimal(count)`) rather than SQL's own `AVG()`: SQLite's `AVG()`
always computes in floating point regardless of the column's declared type
(verified empirically — `SUM`/`MIN`/`MAX` come back as `Decimal`, `AVG`
comes back as `float`), which would silently reintroduce the float-precision
risk `salary_calculation_service` was built to avoid. Deriving the average
from two already-aggregated `Decimal`/`int` scalars keeps the same
Decimal-only guarantee without re-fetching any row data or duplicating
`salary_calculation_service`'s own formula on a whole result set.
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import ColumnElement, and_, func, select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.salary import Salary
from app.services.salary_service import SalaryFilters, build_filter_conditions


@dataclass(frozen=True)
class CurrencyStats:
    """Count/average/minimum/maximum salary for one currency."""

    currency: str
    count: int
    average: Decimal
    minimum: Decimal
    maximum: Decimal


@dataclass(frozen=True)
class GroupStats(CurrencyStats):
    """`CurrencyStats` additionally scoped to one department/country value."""

    group: str


@dataclass(frozen=True)
class SalaryStatisticsResult:
    """The full statistics result: overall, by department, and by country."""

    overall: list[CurrencyStats]
    by_department: list[GroupStats]
    by_country: list[GroupStats]


def get_salary_statistics(
    session: Session, filters: SalaryFilters | None = None
) -> SalaryStatisticsResult:
    """Compute salary statistics matching `filters` (FR-6.1-FR-6.5).

    `filters` reuses `salary_service.SalaryFilters`/`build_filter_conditions`
    unchanged, so analytics filtering stays in lockstep with salary listing
    filtering rather than an independently-maintained copy.
    """
    filters = filters or SalaryFilters()

    overall_rows = _aggregate(session, [Salary.currency], filters, join_employee=False)
    department_rows = _aggregate(
        session, [Employee.department, Salary.currency], filters, join_employee=True
    )
    country_rows = _aggregate(
        session, [Employee.country, Salary.currency], filters, join_employee=True
    )

    return SalaryStatisticsResult(
        overall=[_currency_stats(row) for row in overall_rows],
        by_department=[_group_stats(row) for row in department_rows],
        by_country=[_group_stats(row) for row in country_rows],
    )


def _aggregate(
    session: Session,
    group_by_columns: list[ColumnElement],
    filters: SalaryFilters,
    *,
    join_employee: bool,
) -> list:
    """Run one `GROUP BY` aggregation query over `Salary`.

    Returns `(*group_by_columns, count, total, minimum, maximum)` rows.
    `join_employee` is forced on for department/country grouping (their
    columns live on `Employee`); for the currency-only ("overall") grouping
    it's only added when a `department`/`country` filter needs it, mirroring
    `salary_service.list_salaries`'s own conditional join.
    """
    statement = select(
        *group_by_columns,
        func.count(Salary.id),
        func.sum(Salary.amount),
        func.min(Salary.amount),
        func.max(Salary.amount),
    )

    if join_employee or filters.department or filters.country:
        statement = statement.join(Employee, Salary.employee_id == Employee.id)

    conditions = build_filter_conditions(filters)
    if conditions:
        statement = statement.where(and_(*conditions))

    statement = statement.group_by(*group_by_columns).order_by(*group_by_columns)

    return session.execute(statement).all()


def _currency_stats(row) -> CurrencyStats:
    currency, count, total, minimum, maximum = row
    return CurrencyStats(
        currency=currency, count=count, average=total / Decimal(count), minimum=minimum, maximum=maximum
    )


def _group_stats(row) -> GroupStats:
    group, currency, count, total, minimum, maximum = row
    return GroupStats(
        group=group,
        currency=currency,
        count=count,
        average=total / Decimal(count),
        minimum=minimum,
        maximum=maximum,
    )
