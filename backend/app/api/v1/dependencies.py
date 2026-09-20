"""Shared FastAPI dependencies for `/api/v1` routes."""

from fastapi import HTTPException, Query

from app.services.employee_service import (
    DEFAULT_SORT_BY,
    DEFAULT_SORT_ORDER,
    SORTABLE_FIELDS,
    EmployeeFilters,
    EmployeeSort,
)
from app.utils.pagination import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PaginationParams
from app.utils.sorting import SortOrder


def pagination_params(
    page: int = Query(DEFAULT_PAGE, ge=1, description="1-indexed page number."),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description=f"Records per page (max {MAX_PAGE_SIZE}).",
    ),
) -> PaginationParams:
    """Parse and validate `page`/`page_size` query params.

    FastAPI rejects out-of-range values (e.g. `page=0`, `page_size=1000`)
    with a `422` before this function ever runs, so no manual validation is
    needed here.
    """
    return PaginationParams(page=page, page_size=page_size)


def employee_filters_params(
    search: str | None = Query(
        None,
        description="Case-insensitive match against employee code, first name, or last name.",
    ),
    country: str | None = Query(None, description="Exact-match filter on country."),
    department: str | None = Query(None, description="Exact-match filter on department."),
) -> EmployeeFilters:
    """Parse employee search/filter query params.

    A blank or whitespace-only value is treated the same as an omitted
    one, so `?search=` behaves like no `search` was passed at all.
    """
    return EmployeeFilters(
        search=_blank_to_none(search),
        country=_blank_to_none(country),
        department=_blank_to_none(department),
    )


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def employee_sort_params(
    sort_by: str = Query(
        DEFAULT_SORT_BY,
        description=f"Field to sort by. One of: {', '.join(sorted(SORTABLE_FIELDS))}.",
    ),
    sort_order: SortOrder = Query(DEFAULT_SORT_ORDER, description="Sort direction."),
) -> EmployeeSort:
    """Parse and validate `sort_by`/`sort_order` query params.

    `sort_order` is a `SortOrder` enum, so FastAPI rejects anything other
    than `asc`/`desc` with a `422` before this function runs. `sort_by` is
    checked against the same `SORTABLE_FIELDS` allowlist the service uses
    to build the query, and rejected with a `422` too, for consistency with
    how invalid `page`/`page_size` values are already handled.
    """
    if sort_by not in SORTABLE_FIELDS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported sort_by value: {sort_by!r}. "
                f"Supported values: {', '.join(sorted(SORTABLE_FIELDS))}."
            ),
        )
    return EmployeeSort(sort_by=sort_by, sort_order=sort_order)
