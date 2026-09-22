import pytest
from sqlalchemy.exc import IntegrityError

from app.models.hr_user import HrUser


def _hr_user(**overrides) -> HrUser:
    fields = dict(
        username="hr.admin",
        email="hr.admin@payscope.local",
        password_hash="not-a-real-hash",
    )
    fields.update(overrides)
    return HrUser(**fields)


def test_create_hr_user_applies_default_active_status(db_session) -> None:
    user = _hr_user()
    db_session.add(user)
    db_session.commit()

    assert user.id is not None
    assert user.is_active is True
    assert user.created_at is not None


def test_hr_user_username_must_be_unique(db_session) -> None:
    db_session.add(_hr_user(username="hr.admin", email="one@payscope.local"))
    db_session.commit()

    db_session.add(_hr_user(username="hr.admin", email="two@payscope.local"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_hr_user_email_must_be_unique(db_session) -> None:
    db_session.add(_hr_user(username="one", email="hr.admin@payscope.local"))
    db_session.commit()

    db_session.add(_hr_user(username="two", email="hr.admin@payscope.local"))
    with pytest.raises(IntegrityError):
        db_session.commit()
