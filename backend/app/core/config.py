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
    api_token: str | None = None
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
