from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import UnauthorizedError
from app.db.session import get_db
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.error import ErrorResponse
from app.services import auth_service

# Deliberately has no `dependencies=[Depends(require_auth)]`: this is the one
# `/api/v1` route that must stay reachable without a token, since it's how a
# token is obtained in the first place.
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse, "description": "Incorrect username/email or password"}},
)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    """Exchange an HR user's username/email + password for an access token.

    Accepts either `HrUser.username` or `HrUser.email` in
    `username_or_email` (`auth_service.get_user_by_username_or_email` checks
    both). Rejects an unknown username/email, an incorrect password, and an
    inactive user identically with a `401` (`code="INVALID_CREDENTIALS"`),
    so a caller can never tell which of those applies or whether a given
    username/email exists (`auth_service.authenticate_user`). On success,
    returns a bearer access token (`Authorization: Bearer <access_token>`)
    accepted by every protected `/api/v1` route via the shared `require_auth`
    dependency. Neither the submitted password nor the issued token is ever
    logged.
    """
    user = auth_service.authenticate_user(db, data.username_or_email, data.password)
    if user is None:
        raise UnauthorizedError(
            code="INVALID_CREDENTIALS",
            message="Incorrect username/email or password.",
        )

    access_token, expires_in = auth_service.create_access_token(
        subject=str(user.id), settings=settings
    )

    return TokenResponse(access_token=access_token, expires_in=expires_in)
