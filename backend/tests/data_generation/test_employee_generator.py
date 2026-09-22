import re

from app.data_generation.constants import COUNTRIES, DEPARTMENTS
from app.data_generation.employee_generator import generate_employees
from app.models.employee import EmploymentStatus

_EMAIL_RE = re.compile(r"^[a-z0-9.]+@[a-z0-9.-]+\.[a-z]{2,}$")


def test_generate_employees_returns_empty_list_for_zero_count() -> None:
    assert generate_employees(0) == []


def test_generate_employees_returns_requested_count() -> None:
    employees = generate_employees(25, seed=1)

    assert len(employees) == 25


def test_generate_employees_have_unique_employee_codes() -> None:
    employees = generate_employees(500, seed=1)

    codes = [employee.employee_code for employee in employees]
    assert len(set(codes)) == len(codes)


def test_start_index_offsets_employee_codes() -> None:
    employees = generate_employees(3, seed=1, start_index=100)

    assert [e.employee_code for e in employees] == ["EMP-000100", "EMP-000101", "EMP-000102"]


def test_generate_employees_have_valid_email_addresses() -> None:
    employees = generate_employees(200, seed=2)

    for employee in employees:
        assert _EMAIL_RE.match(employee.email), employee.email


def test_generate_employees_emails_are_unique() -> None:
    employees = generate_employees(200, seed=2)

    emails = [employee.email for employee in employees]
    assert len(set(emails)) == len(emails)


def test_generate_employees_use_supported_departments_and_countries() -> None:
    employees = generate_employees(300, seed=3)

    departments = {employee.department for employee in employees}
    countries = {employee.country for employee in employees}

    assert departments.issubset(set(DEPARTMENTS))
    assert countries.issubset(set(COUNTRIES))
    # With enough records, more than one department/country should appear.
    assert len(departments) > 1
    assert len(countries) > 1


def test_generate_employees_required_fields_are_present() -> None:
    employee = generate_employees(1, seed=4)[0]

    assert employee.employee_code
    assert employee.first_name
    assert employee.last_name
    assert employee.email
    assert employee.department
    assert employee.country
    assert employee.job_title
    assert isinstance(employee.employment_status, EmploymentStatus)


def test_generate_employees_is_reproducible_with_same_seed() -> None:
    first_run = generate_employees(100, seed=42)
    second_run = generate_employees(100, seed=42)

    assert first_run == second_run


def test_generate_employees_differs_across_seeds() -> None:
    first_run = generate_employees(50, seed=1)
    second_run = generate_employees(50, seed=2)

    assert first_run != second_run
