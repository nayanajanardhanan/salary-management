"""Application-level exceptions and centralized FastAPI error handling.

Consistent with `docs/architecture.md` Sections 4.7 and 7.5: a small set of
domain exceptions (`AppError` and its subclasses) are raised by
routes/services and translated here into a single JSON error shape —
`{"error": {"code", "message", "details"}}` — by shared exception handlers,
rather than each route constructing its own `HTTPException`/response. This
also covers FastAPI/Starlette's own `HTTPException` and request validation
errors, so every error response (expected or not) shares the same shape.
Internal details (stack traces, raw exception messages, database errors)
are never returned to the client; unexpected exceptions are logged
server-side and reduced to a generic message (FR-8.3, FR-8.4).
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app")


class AppError(Exception):
    """Base class for expected, domain-level application errors.

    Carries only what the centralized handler needs to build the standard
    envelope (`code`, `message`, optional `details`) plus the HTTP status
    code the response should use. Routes/services raise a subclass with a
    specific `code` (e.g. `"EMPLOYEE_NOT_FOUND"`) rather than constructing
    an `HTTPException`/response body themselves.
    """

    status_code: int = status.HTTP_400_BAD_REQUEST

    def __init__(self, code: str, message: str, *, details: Any | None = None) -> None:
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""

    status_code = status.HTTP_404_NOT_FOUND


class ValidationError(AppError):
    """Raised when request input fails an application-level check.

    FastAPI/Pydantic's own schema validation (types, `ge=`/`le=` bounds,
    etc.) is handled separately by `request_validation_exception_handler`;
    this is for checks that need business context a schema alone can't
    express (e.g. an unsupported `sort_by` value against a field
    allowlist), matching the schema-level vs. service-level validation
    split in `docs/architecture.md` Section 4.6.
    """

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class ConflictError(AppError):
    """Raised when a request conflicts with existing state.

    E.g. creating a salary record for an employee that already has one
    (`Salary.employee_id` is unique — see `app.models.salary.Salary`,
    `docs/requirements.md` FR-2.2): rejected rather than silently
    overwritten, and reported as `409` rather than `422`, since the request
    itself is well-formed — it just can't be applied against the current
    state.
    """

    status_code = status.HTTP_409_CONFLICT


_STATUS_CODE_TO_ERROR_CODE = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_422_UNPROCESSABLE_CONTENT: "UNPROCESSABLE_ENTITY",
}


def _error_response(
    status_code: int, code: str, message: str, details: Any | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details}},
    )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return _error_response(exc.status_code, exc.code, exc.message, exc.details)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Format FastAPI/Starlette's own `HTTPException` in the standard envelope.

    This covers cases outside application code's direct control (e.g. an
    unmatched route, method not allowed) rather than replacing `AppError`,
    which routes/dependencies raise directly for expected domain errors.
    """
    code = _STATUS_CODE_TO_ERROR_CODE.get(exc.status_code, f"HTTP_{exc.status_code}")
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return _error_response(exc.status_code, code, message)


async def request_validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Format FastAPI/Pydantic request validation failures in the standard envelope.

    Preserves the `422` status FastAPI already uses for these, but replaces
    the default `{"detail": [...]}` body with the same
    `{"error": {"code", "message", "details"}}` shape every other error
    uses. `details` lists each failing field's location, message, and error
    type — the same information FastAPI's default body carries — without
    passing through raw `ctx` values, which can contain non-JSON-safe
    objects.
    """
    errors = [
        {"location": list(error["loc"]), "message": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return _error_response(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "VALIDATION_ERROR",
        "Request validation failed.",
        errors,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for anything not already an `AppError`/`HTTPException`.

    Logs the real exception server-side — never in the client-facing
    response — and returns a generic `500` with no internal detail
    (message, type, or traceback), per `docs/architecture.md` Section 4.7 /
    FR-8.3/FR-8.4.
    """
    logger.exception("Unhandled exception while processing %s %s", request.method, request.url.path)
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred.",
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Wire up every centralized handler; called once from `create_app`."""
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
