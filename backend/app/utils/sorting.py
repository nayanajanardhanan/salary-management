"""Generic, safe column-based sorting, reused by any endpoint that lists records.

Mirrors `app/utils/pagination.py`: sorting mechanics (direction, stable
tie-breaking) are defined once here, while each service supplies its own
allowlist mapping sort field *names* to actual model columns. A caller can
therefore never make a raw, user-supplied string reach a query — only a
name already present as a key in that allowlist is ever used.
"""

from enum import Enum
from typing import Mapping

from sqlalchemy import ColumnElement
from sqlalchemy.sql import Select


class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"


def apply_sort(
    statement: Select,
    sortable_fields: Mapping[str, ColumnElement],
    sort_by: str,
    sort_order: SortOrder,
    *,
    tiebreaker: ColumnElement | None = None,
) -> Select:
    """Order `statement` by `sortable_fields[sort_by]`, then by `tiebreaker`.

    `sort_by` must already be validated against `sortable_fields` (a
    `KeyError` propagates otherwise) — this function only ever looks a
    column up in that allowlist, never builds one from a raw string.
    `tiebreaker` (typically a primary key) is appended as a secondary sort
    so rows sharing the same primary sort value still come back in a
    stable, deterministic order across pages; it's skipped when it's the
    same column as the primary sort, to avoid a redundant clause.
    """
    column = sortable_fields[sort_by]
    ordered_column = column.asc() if sort_order == SortOrder.ASC else column.desc()

    order_by_clauses = [ordered_column]
    if tiebreaker is not None and column is not tiebreaker:
        order_by_clauses.append(tiebreaker)

    return statement.order_by(*order_by_clauses)
