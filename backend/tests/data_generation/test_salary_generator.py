from decimal import Decimal

from app.data_generation.constants import COUNTRY_SALARY_PROFILE_BY_NAME
from app.data_generation.employee_generator import generate_employees
from app.data_generation.salary_generator import generate_salaries


def test_generate_salaries_returns_empty_list_for_no_employees() -> None:
    assert generate_salaries([]) == []


def test_generate_salaries_returns_one_salary_per_employee() -> None:
    employees = generate_employees(50, seed=1)

    salaries = generate_salaries(employees, seed=2)

    assert len(salaries) == len(employees)
    assert [s.employee_code for s in salaries] == [e.employee_code for e in employees]


def test_generate_salaries_use_currency_matching_employee_country() -> None:
    employees = generate_employees(200, seed=1)

    salaries = generate_salaries(employees, seed=2)

    by_code = {s.employee_code: s for s in salaries}
    for employee in employees:
        expected_currency = COUNTRY_SALARY_PROFILE_BY_NAME[employee.country].currency
        assert by_code[employee.employee_code].currency == expected_currency


def test_generate_salaries_amount_within_country_range() -> None:
    employees = generate_employees(200, seed=1)

    salaries = generate_salaries(employees, seed=2)

    by_code = {s.employee_code: s for s in salaries}
    for employee in employees:
        profile = COUNTRY_SALARY_PROFILE_BY_NAME[employee.country]
        amount = by_code[employee.employee_code].amount
        assert Decimal(profile.min_annual_salary) <= amount <= Decimal(profile.max_annual_salary)


def test_generate_salaries_amount_is_non_negative_decimal_with_two_places() -> None:
    employees = generate_employees(50, seed=1)

    salaries = generate_salaries(employees, seed=2)

    for salary in salaries:
        assert isinstance(salary.amount, Decimal)
        assert salary.amount >= 0
        assert salary.amount == salary.amount.quantize(Decimal("0.01"))


def test_generate_salaries_currency_codes_are_three_letters() -> None:
    employees = generate_employees(50, seed=1)

    salaries = generate_salaries(employees, seed=2)

    for salary in salaries:
        assert len(salary.currency) == 3
        assert salary.currency.isalpha()
        assert salary.currency.isupper()


def test_generate_salaries_is_reproducible_with_same_seed() -> None:
    employees = generate_employees(100, seed=1)

    first_run = generate_salaries(employees, seed=99)
    second_run = generate_salaries(employees, seed=99)

    assert first_run == second_run
