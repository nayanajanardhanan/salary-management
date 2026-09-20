"""PostgreSQL integration test.

Opt-in only: skipped unless PAYSCOPE_TEST_DATABASE_URL points at a running
PostgreSQL instance. Excluded from the default test run via the "postgres"
marker (see pyproject.toml `addopts`). Run explicitly with:

    pytest -m postgres
"""

import os

import pytest
from sqlalchemy import text

from app.db.session import create_db_engine

pytestmark = pytest.mark.postgres

POSTGRES_TEST_URL = os.environ.get("PAYSCOPE_TEST_DATABASE_URL")


@pytest.mark.skipif(
    not POSTGRES_TEST_URL,
    reason="Set PAYSCOPE_TEST_DATABASE_URL to a real PostgreSQL URL to run this test",
)
def test_can_connect_to_postgres() -> None:
    engine = create_db_engine(POSTGRES_TEST_URL)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar() == 1
