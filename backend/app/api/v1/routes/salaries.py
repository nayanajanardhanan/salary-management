from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import pagination_params, salary_filters_params, salary_sort_params
from app.db.session import get_db
from app.schemas.error import ErrorResponse
from app.schemas.salary import SalaryListResponse, SalaryRead
from app.services import salary_service
from app.services.salary_service import SalaryFilters, SalarySort
from app.utils.pagination import PaginationParams

router = APIRouter(prefix="/api/v1/salaries", tags=["salaries"])


@router.get(
    "",
    response_model=SalaryListResponse,
    responses={422: {"model": ErrorResponse, "description": "Invalid query parameters"}},
)
def list_salaries(
    pagination: PaginationParams = Depends(pagination_params),
    filters: SalaryFilters = Depends(salary_filters_params),
    sort: SalarySort = Depends(salary_sort_params),
    db: Session = Depends(get_db),
) -> SalaryListResponse:
    """List salary records, paginated, optionally filtered, and sorted.

    - `employee_id` / `currency`: exact-match filters on the salary record.
    - `min_amount` / `max_amount`: inclusive bounds on `amount`.
    - `department` / `country`: exact-match filters on the associated
      employee.
    - `sort_by` / `sort_order`: sort the (optionally filtered) results;
      defaults to `id` ascending, i.e. the original listing order.

    All are optional and combine with AND; omitting them preserves the
    plain paginated listing. Returns an empty `items` list, not an error,
    when there are no matching salaries (including when `min_amount`
    exceeds `max_amount`).
    """
    page = salary_service.list_salaries(db, pagination, filters, sort)

    return SalaryListResponse(
        items=[SalaryRead.model_validate(salary) for salary in page.items],
        page=page.page,
        page_size=page.page_size,
        total=page.total,
        has_next=page.has_next,
    )
