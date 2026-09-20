"""Shared FastAPI dependencies for `/api/v1` routes."""

from fastapi import Query

from app.utils.pagination import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PaginationParams


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
