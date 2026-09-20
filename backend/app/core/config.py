from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration sourced from environment variables."""

    app_name: str = "PayScope API"
    environment: str = "development"
    debug: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="PAYSCOPE_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
