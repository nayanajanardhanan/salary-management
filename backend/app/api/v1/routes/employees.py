from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.api.v1.dependencies import employee_filters_params, employee_sort_params, pagination_params
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.employee import Employee
from app.models.salary import Salary
from app.schemas.employee import EmployeeListResponse, EmployeeRead
from app.schemas.error import ErrorResponse
from app.schemas.salary import SalaryCalculatedValues, SalaryRead, SalarySummaryRead
from app.services import employee_service, salary_calculation_service, salary_service
from app.services.employee_service import EmployeeFilters, EmployeeSort
from app.utils.pagination import PaginationParams

router = APIRouter(prefix="/api/v1/employees", tags=["employees"])


def _get_employee_or_404(db: Session, employee_id: int) -> Employee:
    employee = employee_service.get_employee(db, employee_id)
    if employee is None:
        raise NotFoundError(
            code="EMPLOYEE_NOT_FOUND", message=f"Employee {employee_id} not found"
        )
    return employee


def _get_salary_or_404(db: Session, employee_id: int) -> Salary:
    salary = salary_service.get_salary_for_employee(db, employee_id)
    if salary is None:
        raise NotFoundError(
            code="SALARY_NOT_FOUND",
            message=f"No salary record found for employee {employee_id}",
        )
    return salary


@router.get(
    "",
    response_model=EmployeeListResponse,
    responses={422: {"model": ErrorResponse, "description": "Invalid query parameters"}},
)
def list_employees(
    pagination: PaginationParams = Depends(pagination_params),
    filters: EmployeeFilters = Depends(employee_filters_params),
    sort: EmployeeSort = Depends(employee_sort_params),
    db: Session = Depends(get_db),
) -> EmployeeListResponse:
    """List employees, paginated, optionally searched, filtered, and sorted.

    - `search`: case-insensitive match against employee code, first name,
      or last name.
    - `country` / `department`: exact-match filters.
    - `sort_by` / `sort_order`: sort the (optionally filtered) results;
      defaults to `id` ascending, i.e. the original listing order.

    All are optional and combine with AND; omitting them preserves the
    plain paginated listing. Returns an empty `items` list, not an error,
    when there are no matching employees.
    """
    page = employee_service.list_employees(db, pagination, filters, sort)

    return EmployeeListResponse(
        items=[EmployeeRead.model_validate(employee) for employee in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
        has_next=page.has_next,
    )


@router.get(
    "/{employee_id}",
    response_model=EmployeeRead,
    responses={
        404: {"model": ErrorResponse, "description": "Employee not found"},
        422: {"model": ErrorResponse, "description": "Invalid employee_id"},
    },
)
def get_employee(
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> EmployeeRead:
    """Retrieve a single employee by id.

    Raises a `404` if no employee with `employee_id` exists.
    """
    employee = _get_employee_or_404(db, employee_id)

    return EmployeeRead.model_validate(employee)


@router.get(
    "/{employee_id}/salary",
    response_model=SalaryRead,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Employee not found, or the employee has no salary record",
        },
        422: {"model": ErrorResponse, "description": "Invalid employee_id"},
    },
)
def get_employee_salary(
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> SalaryRead:
    """Retrieve the salary record for a single employee.

    Raises a `404` if no employee with `employee_id` exists, or if that
    employee exists but has no associated salary record.
    """
    _get_employee_or_404(db, employee_id)
    salary = _get_salary_or_404(db, employee_id)

    return SalaryRead.model_validate(salary)


@router.get(
    "/{employee_id}/salary/summary",
    response_model=SalarySummaryRead,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Employee not found, or the employee has no salary record",
        },
        422: {"model": ErrorResponse, "description": "Invalid employee_id"},
    },
)
def get_employee_salary_summary(
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> SalarySummaryRead:
    """Retrieve an employee's salary together with calculated summary figures.

    Raises a `404` if no employee with `employee_id` exists, or if that
    employee exists but has no associated salary record.

    `calculated` is produced by `salary_calculation_service`, reused
    unchanged from the existing salary calculation logic rather than
    recomputed here; since each employee has at most one salary record, its
    `total`/`average`/`minimum`/`maximum` all equal `amount` today (see
    `SalaryCalculatedValues`).
    """
    _get_employee_or_404(db, employee_id)
    salary = _get_salary_or_404(db, employee_id)

    salary_read = SalaryRead.model_validate(salary)
    salaries = [salary_read]

    calculated = SalaryCalculatedValues(
        total=salary_calculation_service.total_salary(salaries),
        average=salary_calculation_service.average_salary(salaries),
        minimum=salary_calculation_service.min_salary(salaries),
        maximum=salary_calculation_service.max_salary(salaries),
    )

    return SalarySummaryRead(
        employee_id=salary_read.employee_id,
        amount=salary_read.amount,
        currency=salary_read.currency,
        calculated=calculated,
    )
