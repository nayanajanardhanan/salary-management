from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.data_generation import generate_employee_dataset
from app.data_generation.dataset import EmployeeDataset
from app.data_generation.employee_generator import GeneratedEmployee
from app.data_generation.salary_generator import GeneratedSalary
from app.models.employee import Employee, EmploymentStatus
from app.models.hr_user import HrUser
from app.models.salary import Salary
from app.scripts import seed as seed_module
from app.scripts.seed import DatabaseAlreadySeededError, seed_database, seed_hr_user
from app.services import auth_service


def _employee_count(session) -> int:
    return session.scalar(select(func.count()).select_from(Employee))


def _salary_count(session) -> int:
    return session.scalar(select(func.count()).select_from(Salary))


def test_seed_database_inserts_the_requested_number_of_employees(db_session) -> None:
    result = seed_database(db_session, count=10, seed=1)

    assert result.employees_inserted == 10
    assert _employee_count(db_session) == 10


def test_seed_database_inserts_one_salary_per_employee(db_session) -> None:
    result = seed_database(db_session, count=10, seed=1)

    assert result.salaries_inserted == 10
    assert _salary_count(db_session) == 10


def test_seed_database_respects_configurable_count(db_session) -> None:
    seed_database(db_session, count=3, seed=1)

    assert _employee_count(db_session) == 3


def test_seed_database_preserves_employee_salary_relationship(db_session) -> None:
    seed_database(db_session, count=5, seed=7)

    expected = generate_employee_dataset(5, seed=7)
    expected_salary_by_code = {s.employee_code: s for s in expected.salaries}

    employees = db_session.scalars(select(Employee)).all()
    assert len(employees) == 5
    for employee in employees:
        assert employee.salary is not None
        expected_salary = expected_salary_by_code[employee.employee_code]
        assert employee.salary.amount == expected_salary.amount
        assert employee.salary.currency == expected_salary.currency


def test_seed_database_reuses_the_existing_generator(db_session) -> None:
    seed_database(db_session, count=4, seed=42)

    expected = generate_employee_dataset(4, seed=42)
    employees = db_session.scalars(select(Employee).order_by(Employee.employee_code)).all()

    assert [e.employee_code for e in employees] == [e.employee_code for e in expected.employees]
    assert [e.department for e in employees] == [e.department for e in expected.employees]
    assert [e.country for e in employees] == [e.country for e in expected.employees]


def test_seed_database_refuses_to_run_against_a_non_empty_database_by_default(db_session) -> None:
    seed_database(db_session, count=2, seed=1)

    with pytest.raises(DatabaseAlreadySeededError):
        seed_database(db_session, count=2, seed=2)

    # Nothing from the rejected second call was inserted.
    assert _employee_count(db_session) == 2


def test_seed_database_reset_replaces_existing_data(db_session) -> None:
    seed_database(db_session, count=2, seed=1)

    result = seed_database(db_session, count=5, seed=2, reset=True)

    assert result.employees_inserted == 5
    assert _employee_count(db_session) == 5
    assert _salary_count(db_session) == 5


def test_seed_database_rolls_back_on_failure(db_session, monkeypatch) -> None:
    broken_employee = GeneratedEmployee(
        employee_code="EMP-000001",
        first_name="Test",
        last_name="Employee",
        email="test.employee1@payscope-example.com",
        department="Engineering",
        country="United Kingdom",
        job_title="Software Engineer",
        employment_status=EmploymentStatus.ACTIVE,
    )
    # An employee_code with no matching generated employee can't happen from
    # the real generator, but it deterministically exercises the mid-
    # transaction failure path (building this salary raises KeyError).
    orphan_salary = GeneratedSalary(
        employee_code="EMP-DOES-NOT-EXIST", amount=Decimal("1000.00"), currency="GBP"
    )
    broken_dataset = EmployeeDataset(employees=[broken_employee], salaries=[orphan_salary])
    monkeypatch.setattr(
        seed_module, "generate_employee_dataset", lambda *args, **kwargs: broken_dataset
    )

    with pytest.raises(KeyError):
        seed_database(db_session, count=1, seed=1)

    assert _employee_count(db_session) == 0
    assert _salary_count(db_session) == 0


# --- seed_hr_user ------------------------------------------------------------


def _hr_user_count(session) -> int:
    return session.scalar(select(func.count()).select_from(HrUser))


def test_seed_hr_user_creates_a_new_user(db_session) -> None:
    result = seed_hr_user(
        db_session, username="hr.admin", email="hr.admin@payscope.local", password="s3cret-pw"
    )

    assert result.created is True
    assert result.username == "hr.admin"
    assert _hr_user_count(db_session) == 1


def test_seed_hr_user_hashes_the_password_rather_than_storing_it_as_plaintext(db_session) -> None:
    seed_hr_user(
        db_session, username="hr.admin", email="hr.admin@payscope.local", password="s3cret-pw"
    )

    user = db_session.scalar(select(HrUser).where(HrUser.username == "hr.admin"))
    assert user.password_hash != "s3cret-pw"
    assert auth_service.verify_password("s3cret-pw", user.password_hash)


def test_seed_hr_user_is_idempotent_by_username(db_session) -> None:
    first = seed_hr_user(
        db_session, username="hr.admin", email="hr.admin@payscope.local", password="s3cret-pw"
    )
    second = seed_hr_user(
        db_session,
        username="hr.admin",
        email="hr.admin@payscope.local",
        password="a-different-password",
    )

    assert first.created is True
    assert second.created is False
    assert _hr_user_count(db_session) == 1


def test_seed_hr_user_is_idempotent_by_email_even_with_a_different_username(db_session) -> None:
    seed_hr_user(
        db_session, username="hr.admin", email="hr.admin@payscope.local", password="s3cret-pw"
    )

    result = seed_hr_user(
        db_session,
        username="a-different-username",
        email="hr.admin@payscope.local",
        password="s3cret-pw",
    )

    assert result.created is False
    assert _hr_user_count(db_session) == 1


def test_seed_hr_user_running_the_seed_command_repeatedly_creates_no_duplicates(db_session) -> None:
    for _ in range(5):
        seed_hr_user(
            db_session, username="hr.admin", email="hr.admin@payscope.local", password="s3cret-pw"
        )

    assert _hr_user_count(db_session) == 1
