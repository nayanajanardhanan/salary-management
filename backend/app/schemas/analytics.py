from decimal import Decimal

from pydantic import BaseModel


class CurrencySalaryStats(BaseModel):
    """Salary count/average/minimum/maximum for one currency.

    Every analytics figure is computed within a single currency at a time
    (`docs/requirements.md` FR-6.4, Section 5), so `currency` labels
    exactly which currency `average`/`minimum`/`maximum` are denominated
    in. There is no "total"/sum field: FR-6.1 documents only count,
    average, minimum, and maximum.
    """

    currency: str
    count: int
    average: Decimal
    minimum: Decimal
    maximum: Decimal


class DepartmentSalaryStats(CurrencySalaryStats):
    """Per-currency salary statistics for one department (FR-6.2)."""

    department: str


class CountrySalaryStats(CurrencySalaryStats):
    """Per-currency salary statistics for one country (FR-6.3)."""

    country: str


class SalaryStatistics(BaseModel):
    """Salary summary statistics (FR-6.1-FR-6.5).

    `overall`: count/average/minimum/maximum per currency, across all
    matching salaries. `by_department` / `by_country`: the same figures,
    additionally broken out by department/country (FR-6.2/FR-6.3). Every
    entry in every list is scoped to one currency (FR-6.4) — none of these
    figures ever sum or average across currencies (Section 5). Reflects
    any active filters (FR-6.5), applied before aggregation. A department
    or country with no matching salaries simply has no entry, rather than
    a zero-valued one.
    """

    overall: list[CurrencySalaryStats]
    by_department: list[DepartmentSalaryStats]
    by_country: list[CountrySalaryStats]
