"""Shared page/page_size pagination, reused by any endpoint that lists records.

Centralized here (architecture.md Section 7.3) so pagination behavior —
defaults, limits, total count, `has_next` — is defined once rather than
reimplemented per route.
"""

from dataclasses import dataclass
from typing import Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

T = TypeVar("T")


@dataclass(frozen=True)
class PaginationParams:
    """Validated, 1-indexed page/page_size pair."""

    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


@dataclass(frozen=True)
class Page(Generic[T]):
    """One page of results plus the metadata needed to page further."""

    items: list[T]
    page: int
    page_size: int
    total: int

    @property
    def has_next(self) -> bool:
        return self.page * self.page_size < self.total


def paginate(session: Session, statement: Select, params: PaginationParams) -> Page:
    """Apply `params` to `statement` at the database level and run it.

    `statement` should already have any filtering and a deterministic
    `order_by` applied; only offset/limit are added here. The total count is
    computed from the same (unfiltered-by-pagination) statement via a
    `COUNT` query, so callers get accurate `total`/`has_next` values without
    ever loading the full result set into memory.
    """
    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    items = session.scalars(statement.offset(params.offset).limit(params.page_size)).all()
    return Page(items=list(items), page=params.page, page_size=params.page_size, total=total)
