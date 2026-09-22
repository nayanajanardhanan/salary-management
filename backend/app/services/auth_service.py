"""Password hashing and access-token issuance/verification for HR user login.

Independent of the HTTP layer, mirroring the rest of `app.services` — routes
(`app.api.v1.routes.auth`) and the shared auth dependency
(`app.api.v1.dependencies.require_auth`) call into this module rather than
hashing passwords or handling JWTs themselves.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.hr_user import HrUser

# `bcrypt` truncates/errors past 72 bytes; PayScope has no documented
# requirement for longer passwords, so this is enforced by callers of
# `hash_password` (`app.schemas.auth.LoginRequest` doesn't cap it — bcrypt's
# own limit takes over transparently, consistent with just relying on
# bcrypt's own guarantees rather than duplicating the check).


def hash_password(password: str) -> str:
    """Hash `password` with bcrypt (a salted, adaptive hash) for storage.

    Never store a plaintext password; only ever store/compare this hash.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check `password` against a previously hashed `password_hash`.

    Compares hashes (via bcrypt's constant-time check), never plaintext.
    Returns `False` (rather than raising) for a malformed stored hash, so a
    corrupt row fails closed as "wrong password" instead of a 500.
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def get_user_by_username_or_email(session: Session, identifier: str) -> HrUser | None:
    """Return the HR user whose `username` or `email` exactly matches `identifier`.

    `username`/`email` are both unique (see `HrUser`), so at most one row
    can match.
    """
    statement = select(HrUser).where(
        or_(HrUser.username == identifier, HrUser.email == identifier)
    )
    return session.execute(statement).scalar_one_or_none()


def authenticate_user(session: Session, identifier: str, password: str) -> HrUser | None:
    """Validate a username-or-email + password login attempt.

    Returns the matching `HrUser` only if one exists, is active, and
    `password` matches its stored hash — `None` for every other case
    (unknown identifier, wrong password, inactive user) so callers
    (`app.api.v1.routes.auth.login`) can respond with one generic 401
    without distinguishing why, and never reveal whether a given
    username/email exists.
    """
    user = get_user_by_username_or_email(session, identifier)
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_access_token(
    *, subject: str, settings: Settings, expires_delta: timedelta | None = None
) -> tuple[str, int]:
    """Issue a signed JWT access token identifying `subject` (the HR user's id).

    Signed with `settings.jwt_secret_key`/`jwt_algorithm`; raises `ValueError`
    if no secret is configured, so a misconfigured server fails loudly at
    issuance rather than silently signing with `None`. `expires_delta`
    defaults to `settings.jwt_expire_minutes`; tests pass an explicit value
    (including a negative one) to exercise expiry. Returns the token together
    with its lifetime in whole seconds, for the login response's `expires_in`.
    """
    if not settings.jwt_secret_key:
        raise ValueError("PAYSCOPE_JWT_SECRET_KEY is not configured.")

    delta = (
        expires_delta if expires_delta is not None else timedelta(minutes=settings.jwt_expire_minutes)
    )
    issued_at = datetime.now(timezone.utc)
    payload = {"sub": subject, "iat": issued_at, "exp": issued_at + delta}
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    return token, int(delta.total_seconds())


def decode_access_token(token: str, settings: Settings) -> dict:
    """Verify and decode `token`, returning its claims.

    Raises `jwt.PyJWTError` (or a subclass, e.g. `ExpiredSignatureError`,
    `InvalidSignatureError`) for a missing/invalid/expired token, or if no
    `jwt_secret_key` is configured — callers (`require_auth`) treat every
    such failure identically, as an invalid credential.
    """
    if not settings.jwt_secret_key:
        raise jwt.InvalidKeyError("PAYSCOPE_JWT_SECRET_KEY is not configured.")

    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
