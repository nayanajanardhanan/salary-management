from typing import Any

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """The `error` object every API error response shares.

    `details` is intentionally untyped (`Any | None`): different error
    kinds attach different shapes here (e.g. a list of field-level
    validation errors), while `code`/`message` stay consistent across all
    of them. See `app.core.errors`.
    """

    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    """Standard error envelope returned by every endpoint on failure."""

    error: ErrorDetail
