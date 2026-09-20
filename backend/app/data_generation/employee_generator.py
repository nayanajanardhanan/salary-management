"""Generates synthetic `Employee`-shaped records (no database access).

Reused by tests, local development, future database seeding, and
performance testing (see `app/data_generation/__init__.py`).
"""

import random
import re
from dataclasses import dataclass

from app.data_generation.constants import (
    COUNTRIES,
    DEPARTMENTS,
    EMAIL_DOMAIN,
    FIRST_NAMES,
    JOB_TITLES_BY_DEPARTMENT,
    LAST_NAMES,
)
from app.models.employee import EmploymentStatus

# Most employees are active; a smaller share are inactive/terminated, which
# is more realistic than a uniform split across the three statuses.
_EMPLOYMENT_STATUS_WEIGHTS = {
    EmploymentStatus.ACTIVE: 0.85,
    EmploymentStatus.INACTIVE: 0.10,
    EmploymentStatus.TERMINATED: 0.05,
}
_EMPLOYMENT_STATUSES = tuple(_EMPLOYMENT_STATUS_WEIGHTS.keys())
_EMPLOYMENT_STATUS_WEIGHT_VALUES = tuple(_EMPLOYMENT_STATUS_WEIGHTS.values())

_NON_LETTER_RE = re.compile(r"[^a-z]")


@dataclass(frozen=True)
class GeneratedEmployee:
    """A generated employee record, shaped like `app.models.employee.Employee`.

    Also carries an `email`, which the current `Employee` model does not
    persist, for reuse by anything downstream that needs a contact address
    (e.g. notifications, display). A future seed process may map it onto a
    new column if one is added, or simply ignore it.
    """

    employee_code: str
    first_name: str
    last_name: str
    email: str
    department: str
    country: str
    job_title: str
    employment_status: EmploymentStatus


def generate_employees(
    count: int,
    *,
    seed: int | None = None,
    start_index: int = 1,
    rng: random.Random | None = None,
) -> list[GeneratedEmployee]:
    """Generate `count` employees with unique codes, in insertion order.

    Deterministic for a given `seed` (or shared `rng`): the same seed and
    arguments always produce the same sequence of records. `start_index`
    offsets the generated `employee_code` values, so multiple batches (e.g.
    across seed runs) can be kept unique by the caller.

    `rng` lets callers (e.g. `generate_employee_dataset`) share one random
    source across employee and salary generation; when omitted, a private
    `random.Random(seed)` is created instead.
    """
    rng = rng if rng is not None else random.Random(seed)
    return [_generate_employee(start_index + offset, rng) for offset in range(count)]


def _generate_employee(index: int, rng: random.Random) -> GeneratedEmployee:
    first_name = rng.choice(FIRST_NAMES)
    last_name = rng.choice(LAST_NAMES)
    department = rng.choice(DEPARTMENTS)

    return GeneratedEmployee(
        employee_code=f"EMP-{index:06d}",
        first_name=first_name,
        last_name=last_name,
        email=_build_email(first_name, last_name, index),
        department=department,
        country=rng.choice(COUNTRIES),
        job_title=rng.choice(JOB_TITLES_BY_DEPARTMENT[department]),
        employment_status=rng.choices(
            _EMPLOYMENT_STATUSES, weights=_EMPLOYMENT_STATUS_WEIGHT_VALUES
        )[0],
    )


def _build_email(first_name: str, last_name: str, index: int) -> str:
    # `index` guarantees uniqueness even when names repeat; letters are
    # stripped so accented/hyphenated names (e.g. "van Rossum") still
    # produce a valid, plain-ASCII local part.
    local_part = f"{_slugify(first_name)}.{_slugify(last_name)}{index}"
    return f"{local_part}@{EMAIL_DOMAIN}"


def _slugify(name: str) -> str:
    return _NON_LETTER_RE.sub("", name.lower())
