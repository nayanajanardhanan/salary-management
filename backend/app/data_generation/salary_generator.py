"""Generates synthetic `Salary`-shaped records (no database access).

Reused by tests, local development, future database seeding, and
performance testing (see `app/data_generation/__init__.py`).
"""

import random
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from app.data_generation.constants import COUNTRY_SALARY_PROFILE_BY_NAME
from app.data_generation.employee_generator import GeneratedEmployee

_CENTS = Decimal("0.01")


@dataclass(frozen=True)
class GeneratedSalary:
    """A generated salary record, shaped like `app.models.salary.Salary`.

    Links to its employee via `employee_code` (a natural key) rather than a
    database `employee_id`: no employee has been persisted yet, so no
    numeric id exists. A future seed process resolves `employee_code` to the
    id assigned when the matching employee is inserted.
    """

    employee_code: str
    amount: Decimal
    currency: str


def generate_salaries(
    employees: Sequence[GeneratedEmployee],
    *,
    seed: int | None = None,
    rng: random.Random | None = None,
) -> list[GeneratedSalary]:
    """Generate exactly one salary per employee, in `employees` order.

    Each salary's currency and amount range are derived from the employee's
    `country` (`COUNTRY_SALARY_PROFILE_BY_NAME`), consistent with the
    one-active-salary-per-employee constraint on `app.models.salary.Salary`
    and the requirement that salary analytics never mix currencies
    (requirements.md Section 5).

    `rng` lets callers (e.g. `generate_employee_dataset`) share one random
    source across employee and salary generation; when omitted, a private
    `random.Random(seed)` is created instead.
    """
    rng = rng if rng is not None else random.Random(seed)
    return [_generate_salary(employee, rng) for employee in employees]


def _generate_salary(employee: GeneratedEmployee, rng: random.Random) -> GeneratedSalary:
    profile = COUNTRY_SALARY_PROFILE_BY_NAME[employee.country]
    amount = Decimal(rng.randint(profile.min_annual_salary, profile.max_annual_salary))

    return GeneratedSalary(
        employee_code=employee.employee_code,
        amount=amount.quantize(_CENTS),
        currency=profile.currency,
    )
