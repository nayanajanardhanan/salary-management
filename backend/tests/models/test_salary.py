from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.employee import Employee
from app.models.salary import Salary


def _employee(employee_code: str = "EMP-001") -> Employee:
    return Employee(
        employee_code=employee_code,
        first_name="Ada",
        last_name="Lovelace",
        department="Engineering",
        country="UK",
        job_title="Software Engineer",
    )


def test_salary_links_to_its_employee_both_ways(db_session) -> None:
    employee = _employee()
    db_session.add(employee)
    db_session.flush()

    salary = Salary(employee_id=employee.id, amount=Decimal("95000.00"), currency="GBP")
    db_session.add(salary)
    db_session.commit()

    assert salary.employee is employee
    assert employee.salary is salary


def test_amount_is_stored_as_decimal_not_float(db_session) -> None:
    employee = _employee()
    db_session.add(employee)
    db_session.flush()

    salary = Salary(employee_id=employee.id, amount=Decimal("1234.56"), currency="USD")
    db_session.add(salary)
    db_session.commit()
    db_session.refresh(salary)

    assert isinstance(salary.amount, Decimal)
    assert salary.amount == Decimal("1234.56")


def test_negative_amount_is_rejected(db_session) -> None:
    employee = _employee()
    db_session.add(employee)
    db_session.flush()

    db_session.add(Salary(employee_id=employee.id, amount=Decimal("-1"), currency="GBP"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_employee_cannot_have_more_than_one_salary(db_session) -> None:
    employee = _employee()
    db_session.add(employee)
    db_session.flush()

    db_session.add(Salary(employee_id=employee.id, amount=Decimal("1000"), currency="USD"))
    db_session.commit()

    db_session.add(Salary(employee_id=employee.id, amount=Decimal("2000"), currency="USD"))
    with pytest.raises(IntegrityError):
        db_session.commit()
