import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 (registers models on Base.metadata)
from app.core.config import Settings, get_settings
from app.db.base import Base
from app.db.session import create_db_engine, get_db
from app.main import app
from app.services.auth_service import create_access_token

TEST_JWT_SECRET_KEY = "test-jwt-signing-secret-at-least-32-bytes-long"
"""Fixed JWT signing secret used by the `client`/`unauthenticated_client`
fixtures (via a `get_settings` dependency override, below), not the real
environment/`.env`, so tests behave the same regardless of local
configuration.
"""


def make_test_settings(**overrides: object) -> Settings:
    """`Settings` with a fixed, known `jwt_secret_key`, for dependency overrides.

    Shared by every fixture/test module that needs a `get_settings`
    override, so the JWT signing secret used to mint test tokens
    (`make_test_token`) always matches what `require_auth` verifies against.
    """
    return Settings(_env_file=None, jwt_secret_key=TEST_JWT_SECRET_KEY, **overrides)


def make_test_token(subject: str = "1") -> str:
    """A valid access token signed with `TEST_JWT_SECRET_KEY`, for the `Authorization` header.

    `subject` stands in for an `HrUser.id`; `require_auth` only checks that
    the token is validly signed and unexpired — it doesn't look the subject
    up in the database — so no `HrUser` row needs to exist for this to work.
    """
    token, _ = create_access_token(subject=subject, settings=make_test_settings())
    return token


TEST_ACCESS_TOKEN = make_test_token()
"""Fixed, valid access token used by the `client`/`unauthenticated_client` fixtures."""


@pytest.fixture()
def db_session() -> Session:
    """An isolated, in-memory SQLite session with all model tables created.

    Reuses the app's own engine factory (app.db.session.create_db_engine).
    `StaticPool` keeps a single underlying connection for this in-memory
    database, so it's still visible from the worker thread `TestClient`
    dispatches requests to (SQLite's default per-thread in-memory database
    would otherwise look empty there).
    """
    engine = create_db_engine("sqlite:///:memory:", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> TestClient:
    """A TestClient whose `get_db` dependency is overridden to use `db_session`.

    Every API test therefore runs against the same isolated, in-memory
    database it can set up directly via `db_session`, rather than the real
    app database. `get_settings` is overridden to a fixed JWT signing
    secret, and a matching `Authorization: Bearer <valid access token>`
    header is sent by default, so existing tests against now-authenticated
    endpoints keep exercising their actual behavior unchanged; use
    `unauthenticated_client` to test the authentication requirement itself.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_settings] = lambda: make_test_settings()
    try:
        yield TestClient(app, headers={"Authorization": f"Bearer {TEST_ACCESS_TOKEN}"})
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_settings, None)


@pytest.fixture()
def unauthenticated_client(db_session: Session) -> TestClient:
    """Like `client`, but sends no `Authorization` header by default.

    Uses the same fixed JWT signing secret (via the same `get_settings`
    override) so a request with a deliberately wrong/malformed token is
    guaranteed to be invalid, regardless of local `.env` configuration.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_settings] = lambda: make_test_settings()
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_settings, None)
