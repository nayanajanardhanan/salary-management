from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import pagination_params
from app.db.session import get_db
from app.schemas.employee import EmployeeListResponse, EmployeeRead
from app.services import employee_service
from app.utils.pagination import PaginationParams

router = APIRouter(prefix="/api/v1/employees", tags=["employees"])


@router.get("", response_model=EmployeeListResponse)
def list_employees(
    pagination: PaginationParams = Depends(pagination_params),
    db: Session = Depends(get_db),
) -> EmployeeListResponse:
    """List employees, paginated. Returns an empty `items` list, not an
    error, when there are no matching employees."""
    page = employee_service.list_employees(db, pagination)

    return EmployeeListResponse(
        items=[EmployeeRead.model_validate(employee) for employee in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
        has_next=page.has_next,
    )
