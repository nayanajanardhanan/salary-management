from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import (
    employee_filters_params,
    employee_sort_params,
    pagination_params,
    require_api_token,
)
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.employee import Employee
from app.models.salary import Salary
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeListItem,
    EmployeeListResponse,
    EmployeeRead,
    EmployeeSalaryDetails,
    EmployeeUpdate,
)
from app.schemas.error import ErrorResponse
from app.schemas.salary import (
    SalaryCalculatedValues,
    SalaryCreate,
    SalaryRead,
    SalarySummaryRead,
    SalaryUpdate,
)
from app.services import employee_service, salary_calculation_service, salary_service
from app.services.employee_service import EmployeeFilters, EmployeeSort
from app.utils.pagination import PaginationParams

router = APIRouter(
    prefix="/api/v1/employees",
    tags=["employees"],
    dependencies=[Depends(require_api_token)],
)


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


@router.post(
    "",
    response_model=EmployeeRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse, "description": "employee_code already exists"},
        422: {"model": ErrorResponse, "description": "Invalid request body"},
    },
)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
) -> EmployeeRead:
    """Create a new employee.

    Raises a `409` if `employee_code` already belongs to another employee
    (`Employee.employee_code` is unique). `employment_status` defaults to
    `active` if omitted (see `EmployeeCreate`).
    """
    employee = employee_service.create_employee(db, data)

    return EmployeeRead.model_validate(employee)


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
    - `currency` / `min_salary` / `max_salary`: filter by the employee's
      salary (`docs/requirements.md` FR-4.3); an employee with no salary
      record cannot match a `min_salary`/`max_salary` filter. Combine with
      `currency` to compare within a single currency at a time
      (Section 5).
    - `sort_by` / `sort_order`: sort the (optionally filtered) results;
      defaults to `id` ascending, i.e. the original listing order.

    All are optional and combine with AND; omitting them preserves the
    plain paginated listing. Returns an empty `items` list, not an error,
    when there are no matching employees.

    Each item includes the employee's current salary (`docs/requirements.md`
    Section 8, Acceptance Criterion 1), amount and currency together
    (FR-2.3); `salary` is `null` for an employee with no salary record.
    """
    page = employee_service.list_employees(db, pagination, filters, sort)

    return EmployeeListResponse(
        items=[EmployeeListItem.model_validate(employee) for employee in page.items],
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
    "/{employee_id}/details",
    response_model=EmployeeSalaryDetails,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Employee not found, or the employee has no salary record",
        },
        422: {"model": ErrorResponse, "description": "Invalid employee_id"},
    },
)
def get_employee_details(
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> EmployeeSalaryDetails:
    """Retrieve an employee's core details together with their current salary.

    Raises a `404` if no employee with `employee_id` exists, or if that
    employee exists but has no associated salary record — matching
    `GET .../salary` and `GET .../salary/summary`'s behavior, rather than
    inventing a different convention for the "no salary yet" case. Fetches
    the employee and its salary in a single query
    (`employee_service.get_employee_with_salary`, via `joinedload`) instead
    of two separate lookups.
    """
    employee = employee_service.get_employee_with_salary(db, employee_id)
    if employee is None:
        raise NotFoundError(
            code="EMPLOYEE_NOT_FOUND", message=f"Employee {employee_id} not found"
        )
    if employee.salary is None:
        raise NotFoundError(
            code="SALARY_NOT_FOUND",
            message=f"No salary record found for employee {employee_id}",
        )

    return EmployeeSalaryDetails(
        employee=EmployeeRead.model_validate(employee),
        salary=SalaryRead.model_validate(employee.salary),
    )


@router.patch(
    "/{employee_id}",
    response_model=EmployeeRead,
    responses={
        404: {"model": ErrorResponse, "description": "Employee not found"},
        422: {"model": ErrorResponse, "description": "Invalid request body or employee_id"},
    },
)
def update_employee(
    data: EmployeeUpdate,
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> EmployeeRead:
    """Partially update an employee's editable information.

    Partial update (PATCH semantics): every field in the request body is
    optional, and only fields actually supplied are changed — fields left
    out keep their current value. Raises a `404` if no employee with
    `employee_id` exists. `employee_code` (the employee's unique
    identifier) and `id` cannot be changed through this endpoint; the
    request body rejects any other field outright, and rejects `null` for
    any of its own fields too (see `EmployeeUpdate`). The employee's
    salary is a separate resource, untouched here — see
    `PUT /employees/{employee_id}/salary` to change it.
    """
    employee = employee_service.update_employee(db, employee_id, data)

    return EmployeeRead.model_validate(employee)


@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorResponse, "description": "Employee not found"},
        422: {"model": ErrorResponse, "description": "Invalid employee_id"},
    },
)
def delete_employee(
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> None:
    """Delete an employee.

    Raises a `404` if no employee with `employee_id` exists. Returns
    `204 No Content` on success, with no response body. Deleting an
    employee also deletes its salary record, if one exists: `Employee`'s
    `salary` relationship cascades at the ORM level
    (`cascade="all, delete-orphan"`), and `Salary.employee_id`'s foreign
    key cascades at the database level too (`ondelete="CASCADE"`) — this
    is existing, established relationship behavior, not something new
    introduced by this endpoint.
    """
    employee_service.delete_employee(db, employee_id)


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


@router.post(
    "/{employee_id}/salary",
    response_model=SalaryRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"model": ErrorResponse, "description": "Employee not found"},
        409: {"model": ErrorResponse, "description": "Employee already has a salary record"},
        422: {"model": ErrorResponse, "description": "Invalid request body or employee_id"},
    },
)
def create_employee_salary(
    data: SalaryCreate,
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> SalaryRead:
    """Create the salary record for a single employee.

    Raises a `404` if no employee with `employee_id` exists, and a `409` if
    that employee already has a salary record — each employee has at most
    one (`Salary.employee_id` is unique; `docs/requirements.md` FR-2.2), so
    this never overwrites an existing record.
    """
    _get_employee_or_404(db, employee_id)
    salary = salary_service.create_salary(db, employee_id, data)

    return SalaryRead.model_validate(salary)


@router.put(
    "/{employee_id}/salary",
    response_model=SalaryRead,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Employee not found, or the employee has no salary record",
        },
        422: {"model": ErrorResponse, "description": "Invalid request body or employee_id"},
    },
)
def update_employee_salary(
    data: SalaryUpdate,
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> SalaryRead:
    """Replace an employee's existing salary record.

    Full replacement (PUT semantics): `amount` and `currency` are both
    required and both are overwritten — there is no partial-update (PATCH)
    variant in this commit. Raises a `404` if no employee with
    `employee_id` exists, or if that employee has no salary record yet
    (this endpoint only updates an existing record — see `POST .../salary`
    to create one). `employee_id` is taken from the path and cannot be
    changed through this endpoint; the request body rejects any other
    field outright (see `SalaryUpdate`).
    """
    _get_employee_or_404(db, employee_id)
    salary = salary_service.update_salary(db, employee_id, data)

    return SalaryRead.model_validate(salary)


@router.delete(
    "/{employee_id}/salary",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Employee not found, or the employee has no salary record",
        },
        422: {"model": ErrorResponse, "description": "Invalid employee_id"},
    },
)
def delete_employee_salary(
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> None:
    """Delete an employee's existing salary record.

    Raises a `404` if no employee with `employee_id` exists, or if that
    employee has no salary record to delete. Returns `204 No Content` on
    success, with no response body. Deletes only the `Salary` row —
    `employee_id` is the foreign key on the `Salary` side of the
    relationship, so the employee record itself is never affected.
    """
    _get_employee_or_404(db, employee_id)
    salary_service.delete_salary(db, employee_id)


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
