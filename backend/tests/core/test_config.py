from app.core.config import Settings


def test_database_url_defaults_to_local_sqlite() -> None:
    settings = Settings(_env_file=None)

    assert settings.database_url == "sqlite:///./payscope.db"


def test_database_url_is_read_from_environment(monkeypatch) -> None:
    monkeypatch.setenv(
        "PAYSCOPE_DATABASE_URL",
        "postgresql+psycopg://user:password@localhost:5432/payscope",
    )

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql+psycopg://user:password@localhost:5432/payscope"


def test_cors_origins_defaults_to_local_vite_dev_server() -> None:
    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_cors_origins_parses_comma_separated_environment_value(monkeypatch) -> None:
    monkeypatch.setenv("PAYSCOPE_CORS_ORIGINS", "https://app.example.com, https://admin.example.com")

    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["https://app.example.com", "https://admin.example.com"]


def test_cors_origins_still_accepts_json_array_environment_value(monkeypatch) -> None:
    monkeypatch.setenv("PAYSCOPE_CORS_ORIGINS", '["https://app.example.com"]')

    settings = Settings(_env_file=None)

    assert settings.cors_origins == ["https://app.example.com"]
