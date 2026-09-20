import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app import models  # noqa: F401 (registers models on Base.metadata)
from app.db.base import Base
from app.db.session import create_db_engine
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def db_session() -> Session:
    """An isolated, in-memory SQLite session with all model tables created.

    Reuses the app's own engine factory (app.db.session.create_db_engine) so
    tests don't duplicate engine/session construction logic.
    """
    engine = create_db_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
