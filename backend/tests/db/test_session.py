import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import create_db_engine, get_db


@pytest.fixture()
def sqlite_session_factory(monkeypatch) -> sessionmaker:
    """Point app.db.session at a throwaway in-memory SQLite engine.

    Keeps this test independent of any real database file or server.
    """
    engine = create_db_engine("sqlite:///:memory:")
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    monkeypatch.setattr("app.db.session.SessionLocal", session_factory)
    return session_factory


def test_create_db_engine_builds_a_working_sqlite_engine() -> None:
    engine = create_db_engine("sqlite:///:memory:")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar() == 1


def test_get_db_yields_a_usable_session(sqlite_session_factory: sessionmaker) -> None:
    db = next(get_db())

    assert isinstance(db, Session)
    assert db.execute(text("SELECT 1")).scalar() == 1


def test_get_db_closes_the_session_after_use(sqlite_session_factory: sessionmaker) -> None:
    generator = get_db()
    db = next(generator)
    db.execute(text("SELECT 1"))
    assert db.in_transaction()

    with pytest.raises(StopIteration):
        next(generator)

    assert not db.in_transaction()
