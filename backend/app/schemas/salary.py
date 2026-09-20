from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SalaryRead(BaseModel):
    """Salary fields returned by the API.

    Mirrors `app.models.salary.Salary`'s own columns, excluding the
    salary's own surrogate `id` (an internal detail no client needs,
    since salaries are always addressed via their employee) and the
    `employee` relationship.
    """

    model_config = ConfigDict(from_attributes=True)

    employee_id: int
    amount: Decimal
    currency: str


class SalaryCalculatedValues(BaseModel):
    """Calculated salary figures, produced by `salary_calculation_service`.

    Each employee has at most one salary record (`docs/requirements.md`
    FR-2.2), so these figures are computed, via the calculation service's
    general list-based `total_salary`/`average_salary`/`min_salary`/
    `max_salary` functions, over that single record — and therefore equal
    `SalarySummaryRead.amount` under the current one-salary-per-employee
    model. They are exposed as their own calculated section (rather than
    folded into the original salary fields) so the same shape keeps working
    unchanged if an employee is ever associated with more than one salary
    record.
    """

    model_config = ConfigDict(from_attributes=True)

    total: Decimal
    average: Decimal
    minimum: Decimal
    maximum: Decimal


class SalarySummaryRead(BaseModel):
    """An employee's salary together with calculated summary figures.

    `employee_id`, `amount`, and `currency` are the original values stored
    on the employee's `Salary` record (see `SalaryRead`); `calculated`
    holds the derived figures from `salary_calculation_service`, kept in a
    nested object so original and calculated values are never ambiguous.
    """

    model_config = ConfigDict(from_attributes=True)

    employee_id: int
    amount: Decimal
    currency: str
    calculated: SalaryCalculatedValues
