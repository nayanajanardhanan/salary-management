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
