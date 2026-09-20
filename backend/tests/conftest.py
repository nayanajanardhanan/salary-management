import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 (registers models on Base.metadata)
from app.db.base import Base
from app.db.session import create_db_engine, get_db
from app.main import app


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
    app database.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
