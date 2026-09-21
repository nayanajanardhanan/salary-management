from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Request body for `POST /api/v1/auth/login`.

    `username_or_email` accepts either an `HrUser.username` or `HrUser.email`
    (`app.services.auth_service.get_user_by_username_or_email` looks up
    either); which one was supplied is not distinguished here or in the
    response, so a client never learns which form matched.
    """

    username_or_email: str = Field(..., min_length=1, description="HR user's username or email.")
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """Response body for a successful login.

    Never includes the `HrUser` row itself (so `password_hash` can never
    leak through it, even by omission-mistake) — just enough for the client
    to authenticate subsequent requests. `expires_in` is the token's
    lifetime in whole seconds from issuance, mirroring the OAuth2 token
    response shape without adopting the rest of OAuth2 (no refresh token).
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int
