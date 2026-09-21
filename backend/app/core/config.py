import json
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration sourced from environment variables."""

    app_name: str = "PayScope API"
    environment: str = "development"
    debug: bool = False
    database_url: str = "sqlite:///./payscope.db"

    jwt_secret_key: str | None = None
    """Secret used to sign/verify access tokens issued by `POST
    /api/v1/auth/login` (`app.services.auth_service.create_access_token`),
    and checked by `require_auth` (`app.api.v1.dependencies`) on every
    protected request. Never hardcoded; set per environment. If unset, login
    always fails and no token can ever be verified (fails closed), mirroring
    how the previous static `api_token` behaved when unset.
    """
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    hr_seed_username: str = "hr.admin"
    hr_seed_email: str = "hr.admin@payscope.local"
    hr_seed_password: str | None = None
    """Plaintext password for the development HR user created by
    `app.scripts.seed`'s `seed_hr_user` (hashed before storage, never stored
    or logged as plaintext). Unset by default so a real value is never
    hardcoded here; HR-user seeding is skipped (not a hard failure) when
    unset, matching `app/scripts/README.md`'s existing behavior of clear,
    opt-in seeding steps.
    """

    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    """Origins allowed to call the API from a browser (`docs/architecture.md`
    Section 10/11: "allowed CORS origins" is environment-specific config).
    Defaults to the Vite dev server's default origin for local development;
    set explicitly per environment in production. `NoDecode` disables
    pydantic-settings' own JSON-array decoding for this field so the
    `_parse_cors_origins` validator below can accept a plain comma-separated
    string too, without pydantic-settings rejecting it first as invalid JSON.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="PAYSCOPE_",
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> object:
        """Accepts either a JSON array or a comma-separated string (e.g. from
        `PAYSCOPE_CORS_ORIGINS=a,b` in a plain `.env` file, which is simpler
        to write than JSON-array quoting) for this environment variable.
        """
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if stripped.startswith("["):
            return json.loads(stripped)
        return [origin.strip() for origin in stripped.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
