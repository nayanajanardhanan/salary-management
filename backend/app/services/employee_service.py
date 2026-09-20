"""Business logic for employee queries, independent of the HTTP layer."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.utils.pagination import Page, PaginationParams, paginate


def list_employees(session: Session, pagination: PaginationParams) -> Page[Employee]:
    """Return one page of employees, ordered deterministically by `id`.

    Pagination is applied at the database level via `paginate` (offset/limit
    plus a `COUNT` query), so the full employee table is never loaded into
    memory. Search/filtering (not implemented yet) would add `.where(...)`
    clauses to `statement` below, before it reaches `paginate` — the
    pagination behavior itself would not need to change.
    """
    statement = select(Employee).order_by(Employee.id)
    return paginate(session, statement, pagination)
