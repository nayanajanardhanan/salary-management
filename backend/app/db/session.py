from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def create_db_engine(database_url: str) -> Engine:
    """Build a SQLAlchemy engine for the given connection URL.

    Kept as a standalone factory (rather than only a module-level engine) so
    scripts and tests can create their own engine against a different URL
    (e.g. an in-memory SQLite database) without touching global state.
    """
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args)


engine = create_db_engine(get_settings().database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a request-scoped session, closed afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
