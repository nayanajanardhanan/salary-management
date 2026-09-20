from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


def _app_with_cors_origins(monkeypatch, origins: str):
    """Builds a fresh app instance with a specific `cors_origins` value.

    `create_app()` reads `get_settings()` once at call time to configure
    `CORSMiddleware` (added to the app's middleware stack, not resolved per
    request via `Depends`), so exercising a non-default `cors_origins` value
    means setting the environment `get_settings()` reads *before* calling
    `create_app()`, rather than the `app.dependency_overrides` pattern
    `conftest.py`'s `client` fixture uses for route-level dependencies
    (those overrides would arrive too late for middleware already added at
    app-creation time).
    """
    monkeypatch.setenv("PAYSCOPE_CORS_ORIGINS", origins)
    monkeypatch.setenv("PAYSCOPE_API_TOKEN", "test-token")
    get_settings.cache_clear()
    try:
        return create_app()
    finally:
        get_settings.cache_clear()


def test_allowed_origin_receives_cors_headers_on_preflight(monkeypatch) -> None:
    app = _app_with_cors_origins(monkeypatch, "https://allowed.example.com")
    client = TestClient(app)

    response = client.options(
        "/api/v1/employees",
        headers={
            "Origin": "https://allowed.example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://allowed.example.com"


def test_disallowed_origin_receives_no_cors_allow_header(monkeypatch) -> None:
    app = _app_with_cors_origins(monkeypatch, "https://allowed.example.com")
    client = TestClient(app)

    response = client.options(
        "/api/v1/employees",
        headers={
            "Origin": "https://not-allowed.example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert "access-control-allow-origin" not in response.headers
