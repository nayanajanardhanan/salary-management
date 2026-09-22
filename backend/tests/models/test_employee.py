import pytest
from sqlalchemy.exc import IntegrityError

from app.models.employee import Employee, EmploymentStatus


def _employee(**overrides) -> Employee:
    fields = dict(
        employee_code="EMP-001",
        first_name="Ada",
        last_name="Lovelace",
        department="Engineering",
        country="UK",
        job_title="Software Engineer",
    )
    fields.update(overrides)
    return Employee(**fields)


def test_create_employee_applies_default_employment_status(db_session) -> None:
    employee = _employee()
    db_session.add(employee)
    db_session.commit()

    assert employee.id is not None
    assert employee.employment_status == EmploymentStatus.ACTIVE


def test_employee_code_must_be_unique(db_session) -> None:
    db_session.add(_employee(employee_code="EMP-100"))
    db_session.commit()

    db_session.add(_employee(employee_code="EMP-100", first_name="Grace"))
    with pytest.raises(IntegrityError):
        db_session.commit()
