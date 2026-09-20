from sqlalchemy.orm import DeclarativeBase

from app.db.base import Base


def test_base_is_a_declarative_base() -> None:
    assert issubclass(Base, DeclarativeBase)


def test_base_metadata_has_no_tables_yet() -> None:
    assert list(Base.metadata.tables) == []
