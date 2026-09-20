from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.dependencies import salary_filters_params
from app.db.session import get_db
from app.schemas.analytics import (
    CountrySalaryStats,
    CurrencySalaryStats,
    DepartmentSalaryStats,
    SalaryStatistics,
)
from app.schemas.error import ErrorResponse
from app.services import analytics_service
from app.services.salary_service import SalaryFilters

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get(
    "/salary",
    response_model=SalaryStatistics,
    responses={422: {"model": ErrorResponse, "description": "Invalid query parameters"}},
)
def get_salary_statistics(
    filters: SalaryFilters = Depends(salary_filters_params),
    db: Session = Depends(get_db),
) -> SalaryStatistics:
    """Salary summary statistics: overall, by department, and by country.

    For each of the three views, figures (`count`, `average`, `minimum`,
    `maximum`) are broken out per currency — salary amounts in different
    currencies are never summed or averaged together (`docs/requirements.md`
    FR-6.4, Section 5). `employee_id` / `currency` / `min_amount` /
    `max_amount` / `department` / `country` filter which salaries are
    included, identically to `GET /api/v1/salaries` (FR-6.5), and are
    applied before aggregation, which is computed entirely at the database
    level. A department/country with no matching salaries has no entry.
    """
    result = analytics_service.get_salary_statistics(db, filters)

    return SalaryStatistics(
        overall=[
            CurrencySalaryStats(
                currency=stats.currency,
                count=stats.count,
                average=stats.average,
                minimum=stats.minimum,
                maximum=stats.maximum,
            )
            for stats in result.overall
        ],
        by_department=[
            DepartmentSalaryStats(
                department=stats.group,
                currency=stats.currency,
                count=stats.count,
                average=stats.average,
                minimum=stats.minimum,
                maximum=stats.maximum,
            )
            for stats in result.by_department
        ],
        by_country=[
            CountrySalaryStats(
                country=stats.group,
                currency=stats.currency,
                count=stats.count,
                average=stats.average,
                minimum=stats.minimum,
                maximum=stats.maximum,
            )
            for stats in result.by_country
        ],
    )
