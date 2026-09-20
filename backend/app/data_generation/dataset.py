"""Combines employee and salary generation into one reproducible dataset."""

import random
from dataclasses import dataclass

from app.data_generation.employee_generator import GeneratedEmployee, generate_employees
from app.data_generation.salary_generator import GeneratedSalary, generate_salaries


@dataclass(frozen=True)
class EmployeeDataset:
    """A generated set of employees, each with exactly one matching salary."""

    employees: list[GeneratedEmployee]
    salaries: list[GeneratedSalary]


def generate_employee_dataset(
    count: int, *, seed: int | None = None, start_index: int = 1
) -> EmployeeDataset:
    """Generate `count` employees and one salary each, from a single seed.

    Employee and salary generation share one `random.Random` instance so
    the entire dataset is reproducible from `seed` alone, rather than
    requiring the caller to coordinate two separate seeds. This is the
    main entry point a future seed script or performance test should use.
    """
    rng = random.Random(seed)
    employees = generate_employees(count, start_index=start_index, rng=rng)
    salaries = generate_salaries(employees, rng=rng)
    return EmployeeDataset(employees=employees, salaries=salaries)
