from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.api.v1.dependencies import employee_filters_params, employee_sort_params, pagination_params
from app.db.session import get_db
from app.schemas.employee import EmployeeListResponse, EmployeeRead
from app.services import employee_service
from app.services.employee_service import EmployeeFilters, EmployeeSort
from app.utils.pagination import PaginationParams

router = APIRouter(prefix="/api/v1/employees", tags=["employees"])


@router.get("", response_model=EmployeeListResponse)
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
    responses={404: {"description": "Employee not found"}},
)
def get_employee(
    employee_id: int = Path(..., description="The employee's numeric id."),
    db: Session = Depends(get_db),
) -> EmployeeRead:
    """Retrieve a single employee by id.

    Raises a `404` if no employee with `employee_id` exists.
    """
    employee = employee_service.get_employee(db, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found")

    return EmployeeRead.model_validate(employee)
