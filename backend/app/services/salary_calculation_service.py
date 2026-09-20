"""Pure salary calculation logic, independent of HTTP and database access.

Scope note: `app.models.salary.Salary` stores a single `amount` and
`currency` per employee — there is no gross/net split, no
allowance/deduction breakdown, and no salary period or history (see
`docs/requirements.md` Sections 3.2 and 6.2). Calculations such as "gross
salary", "total allowances", "total deductions", or "net salary" would
therefore require inventing payroll/tax rules the requirements do not
define, which is out of scope; this module does not implement them.

What *is* documented is a currency-safety rule (`docs/requirements.md`
Section 5, FR-6.4, FR-6.5): salary figures in different currencies must
never be summed, averaged, or otherwise combined without an explicit
conversion step. The functions here compute totals/averages/ranges across a
set of salaries while enforcing exactly that rule, so the logic is written
once and reused by any future feature that needs it (payroll runs, reports,
or the analytics service `docs/architecture.md` Section 3 reserves for
grouped statistics), rather than re-implemented per call site.

These functions operate on an already-fetched, in-memory sequence of
salaries and do not query the database themselves (`docs/architecture.md`
Section 4.2: services depend on data access but calculation logic itself
stays decoupled from it). For grouped analytics over the full employee
dataset (~10,000 records), `docs/architecture.md` Sections 1.3/4.3/9
specify SQL-level aggregation (`COUNT`/`AVG`/`MIN`/`MAX` with `GROUP BY`)
rather than pulling every row into the API process — these functions are
not a substitute for that, and are intended for smaller, already-fetched
sets (e.g. a specific payroll batch or export).

No rounding is applied anywhere in this module: `docs/requirements.md` does
not specify a rounding rule for salary figures, so results are returned at
full `Decimal` precision (bounded only by the active decimal context) and
any display-time rounding is left to the caller.
"""

from collections.abc import Sequence
from decimal import Decimal

from app.schemas.salary import SalaryRead


class MixedCurrencyError(ValueError):
    """Raised when salaries spanning more than one currency are combined.

    `docs/requirements.md` Section 5 / FR-6.4 forbid summing, averaging, or
    otherwise combining salary amounts across currencies without an
    explicit conversion step, which is out of scope for the initial
    version.
    """


def ensure_single_currency(salaries: Sequence[SalaryRead]) -> str:
    """Return the shared currency of `salaries`.

    Raises `ValueError` if `salaries` is empty (there is no currency to
    report) and `MixedCurrencyError` if more than one currency is present.
    Every calculation in this module calls this first, so an invalid input
    is rejected before any arithmetic happens.
    """
    if not salaries:
        raise ValueError("Cannot determine a currency for an empty list of salaries.")

    currencies = {salary.currency for salary in salaries}
    if len(currencies) > 1:
        raise MixedCurrencyError(
            f"Cannot combine salaries across multiple currencies: {sorted(currencies)}."
        )
    return next(iter(currencies))


def total_salary(salaries: Sequence[SalaryRead]) -> Decimal:
    """Sum `amount` across `salaries`, which must share a single currency."""
    ensure_single_currency(salaries)
    return sum((salary.amount for salary in salaries), start=Decimal("0"))


def average_salary(salaries: Sequence[SalaryRead]) -> Decimal:
    """Average `amount` across `salaries`, which must share a single currency."""
    ensure_single_currency(salaries)
    return total_salary(salaries) / Decimal(len(salaries))


def min_salary(salaries: Sequence[SalaryRead]) -> Decimal:
    """Return the smallest `amount` across `salaries`, which must share a single currency."""
    ensure_single_currency(salaries)
    return min(salary.amount for salary in salaries)


def max_salary(salaries: Sequence[SalaryRead]) -> Decimal:
    """Return the largest `amount` across `salaries`, which must share a single currency."""
    ensure_single_currency(salaries)
    return max(salary.amount for salary in salaries)
