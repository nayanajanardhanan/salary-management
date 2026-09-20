"""Business logic for salary queries, independent of the HTTP layer."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.salary import Salary


def get_salary_for_employee(session: Session, employee_id: int) -> Salary | None:
    """Return the salary record for `employee_id`, or `None` if it has none.

    `Salary.employee_id` is unique (an employee has at most one active
    salary; see `app.models.salary.Salary`), so `scalar_one_or_none` is
    safe here and, unlike a plain `first()`, raises rather than silently
    picking an arbitrary row if that constraint were ever violated.
    """
    statement = select(Salary).where(Salary.employee_id == employee_id)
    return session.execute(statement).scalar_one_or_none()
